# LiveKit Deployment (Helmfile)

Deploy-Setup fuer den LiveKit-Server auf dem bestehenden Kubernetes-Cluster.
Struktur und Konventionen sind an die ocelot-Releases angelehnt
(`.StateValues.deploy.*`, env-level + release-level secrets via sops).

## Struktur

```
deploy/
  helmfile.yaml.gotmpl                  # 3 Releases: redis, livekit-server, ingress
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
    production/                         # Prod-Keys (sops-encrypted)
      livekit.yaml.gotmpl.example
      meet.yaml.gotmpl.example
  manifests/
    redis.yaml.gotmpl                   # Vanilla Redis (StatefulSet + Service)
    ingressroute.yaml.gotmpl            # Issuer + Certificate + IngressRoute
    meet.yaml.gotmpl                    # Cert + Secret + Deployment + IngressRoute (Meet-UI)
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
# erwartet: HTTP/2 200 mit "OK" body (LiveKit Health-Endpoint)

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
