"use client";

import { useState, useEffect } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

const MAPS_API_KEY = "AIzaSyAapi6SdaSAzwXhjdmsc8ZYi5pgrsTCGwE";
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

const mapContainerStyle = { width: "100%", height: "320px" };
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "greedy",
};

interface Crew {
  uid: string;
  displayName: string;
  photoURL: string;
  isLocationVisible: boolean;
  location?: { lat: number; lng: number };
}

interface Post {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: { seconds: number } | null;
}

export default function MapApp() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selected, setSelected] = useState<Crew | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, "crews"), (snap) => {
      const all = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as Crew));
      setCrews(all.filter((c) => c.isLocationVisible && c.location));
    });
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
    });
  }, []);

  const mapCenter =
    crews.length > 0 && crews[0].location
      ? { lat: crews[0].location.lat, lng: crews[0].location.lng }
      : DEFAULT_CENTER;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="font-semibold text-slate-900 text-sm">크루 지도</span>
        <span className="text-xs text-slate-400">
          {crews.length > 0 ? `${crews.length}명 활동 중` : "활동 중인 크루 없음"}
        </span>
      </div>

      {/* 지도 */}
      <LoadScript googleMapsApiKey={MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={13}
          options={mapOptions}
        >
          {crews.map((crew) =>
            crew.location ? (
              <Marker
                key={crew.uid}
                position={{ lat: crew.location.lat, lng: crew.location.lng }}
                onClick={() => setSelected(crew)}
              />
            ) : null
          )}

          {selected && selected.location && (
            <InfoWindow
              position={{ lat: selected.location.lat, lng: selected.location.lng }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="flex items-center gap-2 py-0.5 pr-1">
                {selected.photoURL ? (
                  <img
                    src={selected.photoURL}
                    className="w-8 h-8 rounded-full"
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200" />
                )}
                <span className="text-sm font-medium text-slate-900">
                  {selected.displayName}
                </span>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>

      {/* 피드 */}
      <div className="px-4 pt-4 pb-12 space-y-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          크루 근황
        </p>

        {posts.length === 0 && (
          <p className="text-xs text-slate-300 text-center py-10">
            아직 근황이 없어요
          </p>
        )}

        {posts.map((post) => (
          <div key={post.id} className="flex gap-3">
            {post.photoURL ? (
              <img
                src={post.photoURL}
                className="w-8 h-8 rounded-full shrink-0 mt-0.5"
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-slate-700">
                {post.displayName}
              </span>
              <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
                {post.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
