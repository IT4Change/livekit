// IT4C Meet -- Room Page (Server-Component)
//
// Override fuer livekit-examples/meet/app/rooms/[roomName]/page.tsx.
// Behaelt die existing PageClientImpl-Logik bei, ergaenzt aber
// generateMetadata: Beim Sharing eines Raum-Links (z.B. in Slack/Discord)
// wird der Display-Name aus ALLOWED_ROOMS_JSON als Page-Title angezeigt.

import * as React from 'react';
import type { Metadata } from 'next';
import { PageClientImpl } from './PageClientImpl';
import { isVideoCodec } from '@/lib/types';

function lookupDisplayName(roomName: string): string | undefined {
  try {
    const rooms = JSON.parse(process.env.ALLOWED_ROOMS_JSON ?? '[]');
    if (!Array.isArray(rooms)) return undefined;
    const found = rooms.find((r: any) => r?.name === roomName);
    return found?.displayName ?? found?.displayname;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomName: string }>;
}): Promise<Metadata> {
  const { roomName } = await params;
  const displayName = lookupDisplayName(roomName) ?? roomName;
  return {
    title: `${displayName} | IT4C Meet`,
    description: `Beitritt zum Raum "${displayName}"`,
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{
    region?: string;
    hq?: string;
    codec?: string;
    singlePC?: string;
  }>;
}) {
  const _params = await params;
  const _searchParams = await searchParams;
  const codec =
    typeof _searchParams.codec === 'string' && isVideoCodec(_searchParams.codec)
      ? _searchParams.codec
      : 'vp9';
  const hq = _searchParams.hq === 'true' ? true : false;
  const singlePC = _searchParams.singlePC !== 'false';

  return (
    <PageClientImpl
      roomName={_params.roomName}
      region={_searchParams.region}
      hq={hq}
      codec={codec}
      singlePeerConnection={singlePC}
    />
  );
}
