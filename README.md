# LiveKit Deployment (Helmfile)

Deploy-Setup fuer den LiveKit-Server auf dem bestehenden Kubernetes-Cluster.
Struktur und Konventionen sind an die ocelot-Releases angelehnt
(`.StateValues.deploy.*`, env-level + release-level secrets via sops).

## Struktur

```
deploy/
  helmfile.yaml.gotmpl                  # Releases: redis, livekit-server, ingress, meet, monitoring
  environments/
    default.yaml.gotmpl                 # Staging (livekit.stage.it4c.org)
    default.secrets.yaml.example        # Vorlage; sops-encrypted committen
    production.yaml.gotmpl              # Prod    (livekit.it4c.dev)
    production.secrets.yaml.example
  values/
    livekit.yaml.gotmpl                 # Chart-Values livekit-server
  secrets/
    .gitignore                          # Klartext-Secrets nicht committen
    default/                            # Stage-Keys (sops-encrypted)
      livekit.yaml.gotmpl.example
      meet.yaml.gotmpl.example
      monitoring.yaml.gotmpl.example    # Discord-Webhook fuer Alertmanager
    production/                         # Prod-Keys (sops-encrypted)
      livekit.yaml.gotmpl.example
      meet.yaml.gotmpl.example
      monitoring.yaml.gotmpl.example
  manifests/
    redis.yaml.gotmpl                   # Vanilla Redis (StatefulSet + Service)
    ingressroute.yaml.gotmpl            # Issuer + Certificate + IngressRoute
    meet.yaml.gotmpl                    # Cert + Secret + Deployment + IngressRoute (Meet-UI)
    monitoring.yaml.gotmpl              # Service + ServiceMonitor + PrometheusRule + AlertmanagerConfig + Dashboard
```

Redis laeuft als minimales `redis:7-alpine` StatefulSet ueber den `bedag/raw`-
Chart. Das Bitnami-Chart wurde bewusst nicht genommen, weil Bitnami im August
2025 die Public-Images weitgehend hinter Subscription gestellt hat -- jeder
neue Chart-Pull haette sonst `ErrImagePull`.

## Voraussetzungen

- `helmfile`, `helm`, `kubectl`, `sops`, `helm-secrets`-Plugin
  (`helm plugin install https://github.com/jkroepke/helm-secrets`)
- SOPS-Konfig (`.sops.yaml` im Repo-Root oder ENV `SOPS_AGE_KEY` / GPG-Key)
- `kubectl`-Context auf Staging-Cluster
- Traefik v3 mit EntryPoint `websecure` und TLS aktiv -- bestaetigt: `v3.6.13`
- cert-manager im Cluster -- bestaetigt: CRDs vorhanden, kein ClusterIssuer
- DNS (Staging): `livekit.stage.it4c.org` (Signaling) und
  `meet.stage.it4c.org` (Meet-UI, Phase 2) -> Cluster-Ingress-IP (A/AAAA),
  via Tofu in der Hetzner-Zone gepflegt
- DNS bzw. Firewall: UDP/7882 auf der EXTERNAL-IP des Cluster-Nodes
  muss von aussen erreichbar sein (RTC-Mux)

## Erst-Setup

Beispiel hier: env `default` (Staging). Fuer `production` analog mit
`secrets/production/...` und `helmfile -e production ...`.

```sh
cd livekit/

# 1. Namespace
kubectl create namespace livekit-staging

# 2. Env-Secret (acme_email) anlegen + verschluesseln
cp environments/default.secrets.yaml.example environments/default.secrets.yaml
$EDITOR environments/default.secrets.yaml
sops -e -i environments/default.secrets.yaml

# 3a. Release-Secret livekit (API-Keys fuer ocelot UND Meet-UI) anlegen.
#     Wird vom livekit-server Helm-Chart selbst zu einem K8s-Secret gerendert.
cp secrets/default/livekit.yaml.gotmpl.example secrets/default/livekit.yaml.gotmpl
$EDITOR secrets/default/livekit.yaml.gotmpl
sops -e -i secrets/default/livekit.yaml.gotmpl

# 3b. Env-Level-Secret meet (Credentials, mit denen das Meet-UI Tokens signiert).
#     Wird im Manifest als .StateValues.secrets.meet.* ausgelesen -- bedag/raw
#     kann selbst keine Secret-Werte rendern, daher env-level statt release-level.
cp secrets/default/meet.yaml.gotmpl.example secrets/default/meet.yaml.gotmpl
$EDITOR secrets/default/meet.yaml.gotmpl
sops -e -i secrets/default/meet.yaml.gotmpl
# WICHTIG: Den Meet-API-Key aus 3b zusaetzlich in 3a unter
# storeKeysInSecret.keys eintragen, sonst akzeptiert der LiveKit-Server
# die vom Meet-UI signierten Tokens nicht.

# 4. DNS pruefen -- livekit.stage.it4c.org und meet.stage.it4c.org muessen
#    vor dem Sync schon zeigen, sonst scheitert die HTTP-01-Challenge.
dig +short livekit.stage.it4c.org meet.stage.it4c.org

# 5. Helm-Repos pullen
helmfile -e default deps

# 6. Diff
helmfile -e default diff

# 7. Sync
helmfile -e default sync
```

## Smoketest

```sh
# Pods Running?
kubectl -n livekit-staging get pods

# Cert ausgestellt?
kubectl -n livekit-staging get certificate
# READY=True erwartet. Sonst:
#   kubectl -n livekit-staging describe certificate livekit-tls
#   kubectl -n livekit-staging get challenges
#   kubectl -n livekit-staging describe challenge <name>

# LB-IP fuer UDP/RTC
kubectl -n livekit-staging get svc livekit-server
# EXTERNAL-IP merken; UDP/7882 muss von aussen erreichbar sein.

# WSS via Traefik
curl -i https://livekit.stage.it4c.org/
# erwartet: HTTP/2 404 mit body "404 page not found" (19 bytes).
# LiveKit hat keine /-Route -- der 404 zeigt nur, dass TLS+Routing klappen.
# Echter End-to-End-Test ist der WSS-Connect (livekit-cli oder Browser).

# Connection-Test mit livekit-cli (lokal)
livekit-cli create-token \
  --api-key APIstaging001 --api-secret <SECRET> \
  --room test-room --identity tester \
  --url wss://livekit.stage.it4c.org

livekit-cli join-room \
  --url wss://livekit.stage.it4c.org \
  --token <output-of-create-token>
```

## Domain-Konvention

Pro Environment werden zwei Domains gepflegt:

- `LIVEKIT_DOMAIN` -- Signaling-Server (WSS + RTC-Endpoints).
  Staging: `livekit.stage.it4c.org` ; Prod: `livekit.it4c.dev`
- `MEET_DOMAIN` -- Default-Conferencing-Frontend (Meet-UI, Phase 2).
  Staging: `meet.stage.it4c.org` ; Prod: `meet.it4c.dev`

TLS-Secret-Konvention: Domain mit Bindestrichen statt Punkten + `-tls`.
Aenderungen in `environments/{default,production}.yaml.gotmpl`, dann
`helmfile -e <env> sync`. Vor dem Sync DNS-Aufloesung pruefen, sonst
schlaegt die HTTP-01-Challenge fehl.

## Externe Redis nutzen

In `environments/default.yaml.gotmpl`:
```yaml
redis:
  MANAGED: false
  EXTERNAL_ADDRESS: redis.<ns>.svc.cluster.local:6379
```
Das Redis-Release wird durch das `if eq .StateValues.redis.MANAGED true` im
helmfile dann automatisch nicht mehr ausgerollt.

## Trial-and-Error mit Lets-Encrypt-Staging

Echte LE-Zertifikate haben 5/Woche/Domain Limit. Waehrend Konfig-Iteration:

```yaml
# environments/default.yaml.gotmpl
deploy:
  ACME_ISSUER: letsencrypt-staging
```

Browser zeigt dann "untrusted" Warnung -- das ist erwartet. Nach erfolgreicher
Issuance wieder auf `letsencrypt-prod` flippen und syncen.

## Monitoring + Discord-Alerts

LiveKit-Server exposed Prometheus-Metriken auf Port `6789`. Das `monitoring`-
Release rollt darauf auf:

- **Service** `livekit-server-metrics` (headless) -- expose `:6789` mit
  fest gewaehltem Port-Name `metrics`, unabhaengig vom Chart-Naming
- **ServiceMonitor** -- kube-prometheus-stack Discovery
- **PrometheusRule** -- Alerts auf Teilnehmer-Aenderungen via Gauge-Diff
  (`livekit_participant_total` vs. offset 1m). Counter-basierte Joins
  bewusst nicht: zaehlt jeden ICE-Reconnect/Reload als Join.
- **Secret** `livekit-discord-webhook` -- Webhook-URL mit auto-angehaengtem
  /slack-Suffix
- **AlertmanagerConfig** -- routet `channel=discord` an Discord via
  slackConfigs (Discord nimmt Slack-Format auf `<webhook>/slack` an)
- **ConfigMap** `livekit-grafana-dashboard` -- Sidecar-Discovery, optional

### Voraussetzungen

- kube-prometheus-stack im Cluster (`monitoring.coreos.com/v1` und
  `v1alpha1` CRDs vorhanden)
- Alertmanager mit Cross-Namespace-Selektor: `alertmanagerConfigSelector`
  und `alertmanagerConfigNamespaceSelector` am `Alertmanager`-CR offen
  (z.B. `{}`) damit unsere AMConfig aus `livekit-staging`/`livekit`
  gepicked wird
- Optional: Grafana mit Dashboard-Sidecar

### Setup

```sh
# 1. Discord-Webhook in deinem Discord-Server anlegen
#    Server-Settings -> Integrations -> Webhooks -> New Webhook
#    Webhook-Name beliebig (wird ueberschrieben durch monitoring.DISCORD_USERNAME).
#    URL kopieren (OHNE /slack-Suffix -- das Manifest haengt es selbst an).

# 2. Bot-Anzeigename pro env in environments/<env>.yaml.gotmpl setzen:
#    monitoring.DISCORD_USERNAME: "Meet Stage" / "Meet"

# 3. Secret-File anlegen + verschluesseln
cp secrets/default/monitoring.yaml.gotmpl.example secrets/default/monitoring.yaml.gotmpl
$EDITOR secrets/default/monitoring.yaml.gotmpl
sops -e -i secrets/default/monitoring.yaml.gotmpl

# 4. Release-Label des kube-prometheus-stack pruefen
kubectl get prometheus -A -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.serviceMonitorSelector}{"\n"}{end}'
# Falls Selector nicht "release: prometheus" ist:
# environments/default.yaml.gotmpl -> monitoring.PROMETHEUS_RELEASE_LABEL_*

# 5. Deploy
helmfile -e default sync
```

### Smoketest

```sh
# ServiceMonitor + AMConfig angekommen?
kubectl -n livekit-staging get servicemonitor,prometheusrule,alertmanagerconfig

# Prometheus-Target up?
kubectl -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 &
curl -s 'http://localhost:9090/api/v1/targets' | jq '.data.activeTargets[] | select(.labels.namespace=="livekit-staging") | {health}'
kill %1

# In einen Meet-Raum joinen, 30-60s warten.
# Erwartet: Discord-Ping, Bot-Name "Meet Stage", Body mit Meet-URL.
```

### Doppelte Pings ausschalten

Der Prometheus-Operator setzt auf alle AMConfig-Subrouten hardcoded
`continue: true`. Effekt: Alert geht an unsere LiveKit-Discord-Route
(richtig), faellt aber durch auf den cluster-weiten Catch-all -> zweiter
Ping auf den allgemeinen Cluster-Discord.

Fix im cluster-weiten kube-prometheus-stack-values, **nach** den
bestehenden null-Routen ergaenzen:

```yaml
alertmanager:
  config:
    route:
      routes:
        - match: { alertname: KubeProxyDown }
          receiver: "null"
        # ... bestehende null-Routen ...
        - match: { severity: none }
          receiver: "null"
        # NEU: Fallthrough fuer LiveKit unterdruecken. Funktioniert nur
        # wenn der Operator AMConfig-Routen vor hand-written sortiert
        # (≥ Operator 0.74 / kube-prometheus-stack ≥ 50). Pruefbar via:
        #   kubectl -n monitoring get secret alertmanager-prometheus-kube-prometheus-alertmanager-generated \
        #     -o jsonpath='{.data.alertmanager\.yaml\.gz}' | base64 -d | gunzip
        # -> die operator-injected Subroute mit matchers: ['namespace="livekit-staging"']
        #    muss vor den hand-written Subrouten erscheinen.
        - match: { namespace: livekit-staging }
          receiver: "null"
        - match: { namespace: livekit }
          receiver: "null"
```

Falls Operator-Routen NACH hand-written sortieren (alte Operator-Version),
wuerde diese Null-Route die LiveKit-Alerts vor unserer AMConfig abfangen.
In dem Fall ist die einzig saubere Loesung, das Routing komplett im
cluster-Config zu pflegen (Receiver dort, AMConfig hier weg).

### Caveats

- **Reconnects/Page-Reloads**: Counter `livekit_participant_join_total`
  zaehlt jeden Connect (ICE-Reconnect, Tab-Reload, Network-Switch).
  Deshalb alerten wir auf Gauge-Diff -- das misst Netto-Aenderung, nicht
  Connect-Events. Ein User mit drei parallelen Tabs zaehlt trotzdem als 3.
- **Kein Raum-Bezug**: `livekit_participant_total` hat keinen `room`-Label
  (zu hoch-kardinal). Discord-Message verlinkt die Meet-Landing, nicht
  den konkreten Raum. Pro-Raum-Notifications waere LiveKit-Webhook-Pfad.
- **Anti-Flap**: Alert hat `for: 30s`. Spikes unter 30s feuern nicht.
  Absicht (sonst Reconnect-Storm = Push-Storm).
- **Bot-Name "alertmanager"**: passiert wenn `monitoring.DISCORD_USERNAME`
  leer ist oder das Secret-File nicht im Slack-Format-Endpoint landet.
  `username:` im slackConfigs setzt das Discord-Bot-Namensfeld via
  Slack-Payload.
- **AMConfig-Pickup**: Der Alertmanager muss configs aus dem LiveKit-NS
  lesen duerfen. Default des kube-prometheus-stack ist oft auf den
  `monitoring`-NS beschraenkt -- Stack-Values
  `alertmanager.alertmanagerSpec.alertmanagerConfigNamespaceSelector: {}`
  oeffnet das auf alle NS.
- **Vanilla-Prometheus ohne Operator**: `monitoring.MANAGED=false` setzen,
  dann reicht die `prometheus.io/scrape`-Annotation am livekit-server-Pod;
  Routing nach Discord in der zentralen `alertmanager.yml` haendisch
  ergaenzen.

## Egress / Aufnahmen

Noch nicht enthalten -- Phase 4 im Konzept. Wenn relevant: zusaetzliches
Release `livekit-egress` (Chart `livekit/egress`) plus MinIO oder externer S3.

## Bekannte Stolperfallen

- **UDP nicht erreichbar**: Cluster-LoadBalancer akzeptiert UDP nicht oder
  blockiert Outbound-STUN. Workaround: `livekit.USE_EXTERNAL_IP: false` und
  `LIVEKIT_NODE_IP` per Env auf die LB-IP setzen.
- **WSS-Handshake-Timeout**: Traefik-Service-Timeout zu kurz. In Traefik die
  `transport.respondingTimeouts` hochsetzen oder im IngressRoute eine
  `ServersTransport` mit hohen Timeouts referenzieren.
- **Auto-Create war an**: Wenn das Backend Tokens generiert ohne vorher
  `createRoom()` aufzurufen, kommt `room not found`. Ist korrekt -- Multi-
  Tenancy-Hygiene erzwingt expliziten Backend-Call.
- **Cert-Issuance haengt**: HTTP-01 braucht Port 80 erreichbar. `kubectl -n
  livekit-staging get challenges` zeigt warum's klemmt.
- **sops kann nicht entschluesseln**: SOPS_AGE_KEY oder GPG-Key fehlt im
  aktiven Shell. `sops -d secrets/default/livekit.yaml.gotmpl` zum Test.
