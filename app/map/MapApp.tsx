"use client";

import { useState, useEffect } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";

const MAPS_API_KEY = "AIzaSyAapi6SdaSAzwXhjdmsc8ZYi5pgrsTCGwE";
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "cooperative",
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
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
    });
  }, []);

  const mapCenter =
    crews.length > 0 && crews[0].location
      ? { lat: crews[0].location.lat, lng: crews[0].location.lng }
      : DEFAULT_CENTER;

  const selectedPosts = selected
    ? posts.filter((p) => p.uid === selected.uid)
    : [];

  return (
    <div className="flex flex-col md:h-screen md:flex-row md:overflow-hidden bg-white">

      {/* 지도 - 70% */}
      <div className="h-[70vh] md:h-full md:w-[70%] shrink-0 relative">
        <LoadScript googleMapsApiKey={MAPS_API_KEY}>
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
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
          </GoogleMap>
        </LoadScript>

        {/* 활동 중 뱃지 */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm text-xs font-medium text-slate-700">
          {crews.length > 0 ? `${crews.length}명 활동 중` : "활동 중인 사람 없음"}
        </div>

        {/* 모바일 안내 */}
        <div className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-3 py-1 rounded-full pointer-events-none">
          두 손가락으로 지도 이동 · 한 손가락으로 스크롤
        </div>

        {/* 홈 버튼 */}
        <button
          onClick={() => window.location.assign("/babara/crew/")}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm text-xs font-medium text-slate-700 hover:bg-white transition-colors"
        >
          홈으로
        </button>
      </div>

      {/* 피드 패널 - 30% */}
      <div className="md:flex-1 md:w-[30%] flex flex-col border-t md:border-t-0 md:border-l border-slate-100 md:overflow-hidden min-h-[40vh] md:min-h-0">

        {!selected ? (
          /* 선택 안 됐을 때 */
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">지도에서 사람을 선택하면<br />피드가 여기 표시돼요</p>
          </div>
        ) : (
          /* 선택했을 때 */
          <div className="flex flex-col h-full overflow-hidden">
            {/* 프로필 헤더 */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 shrink-0">
              {selected.photoURL ? (
                <img
                  src={selected.photoURL}
                  className="w-11 h-11 rounded-full"
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-200" />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{selected.displayName}</p>
                <p className="text-xs text-green-600 mt-0.5">지금 여기 있어요</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-300 hover:text-slate-500 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 포스트 피드 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {selectedPosts.length === 0 ? (
                <p className="text-xs text-slate-300 text-center py-8">
                  아직 올린 근황이 없어요
                </p>
              ) : (
                selectedPosts.map((post) => (
                  <div key={post.id}>
                    <p className="text-sm text-slate-700 leading-relaxed">{post.text}</p>
                    <div className="border-b border-slate-50 mt-4" />
                  </div>
                ))
              )}
            </div>

            {/* 프로필 보기 버튼 */}
            <div className="px-4 py-3 border-t border-slate-100 shrink-0">
              <button
                onClick={() => window.location.assign(`/babara/profile/?uid=${selected.uid}`)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                프로필 보기 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
