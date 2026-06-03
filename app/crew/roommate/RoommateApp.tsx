"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";

interface Friend {
  uid: string;
  displayName: string;
  photoURL: string;
  status: "accepted";
}

interface FriendProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  isLocationVisible?: boolean;
  location?: { lat: number; lng: number };
}

export default function RoommateApp() {
  const [uid, setUid] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderOpen, setFolderOpen] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
      else window.location.assign("/babara/crew/");
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, "crews", uid, "friends"), async (snap) => {
      const accepted = snap.docs
        .filter((d) => d.data().status === "accepted")
        .map((d) => ({ uid: d.id, ...d.data() } as Friend));

      // 각 친구의 프로필 가져오기
      const profiles = await Promise.all(
        accepted.map(async (f) => {
          const snap = await getDoc(doc(db, "crews", f.uid));
          if (snap.exists()) {
            return { uid: f.uid, ...snap.data() } as FriendProfile;
          }
          return { uid: f.uid, displayName: f.displayName, photoURL: f.photoURL };
        })
      );
      setFriends(profiles);
      setLoading(false);
    });
  }, [uid]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 네비바 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900 h-14 flex items-center px-4 gap-3 shadow-md">
        <button
          onClick={() => window.location.assign("/babara/crew/")}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-white font-semibold text-sm">룸메이트</span>
      </div>

      <div className="pt-14 max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* MY CHEF 폴더 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* 폴더 헤더 */}
          <button
            onClick={() => setFolderOpen(!folderOpen)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* 폴더 아이콘 */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${folderOpen ? "bg-slate-900" : "bg-slate-200"}`}>
                <svg viewBox="0 0 24 24" className={`w-5 h-5 ${folderOpen ? "text-white" : "text-slate-600"}`} fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 tracking-wide">MY CHEF</p>
                <p className="text-xs text-slate-400">{friends.length}명</p>
              </div>
            </div>
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${folderOpen ? "" : "-rotate-90"}`}
              fill="none" stroke="currentColor" strokeWidth={2}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* 폴더 내용 */}
          {folderOpen && (
            <div className="border-t border-slate-100">
              {loading && (
                <p className="text-sm text-slate-300 text-center py-8">불러오는 중...</p>
              )}
              {!loading && friends.length === 0 && (
                <div className="text-center py-10 space-y-2">
                  <p className="text-sm text-slate-300">아직 친구가 없어요</p>
                  <button
                    onClick={() => window.location.assign("/babara/crew/")}
                    className="text-xs text-slate-400 underline"
                  >
                    내 주소 보내서 친구 추가하기
                  </button>
                </div>
              )}
              {friends.map((friend) => (
                <button
                  key={friend.uid}
                  onClick={() => window.location.assign(`/babara/profile/?uid=${friend.uid}`)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                >
                  {friend.photoURL ? (
                    <img
                      src={friend.photoURL}
                      className="w-10 h-10 rounded-full shrink-0"
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-slate-900">{friend.displayName}</p>
                    {friend.isLocationVisible && (
                      <p className="text-xs text-green-500 mt-0.5">위치 공유 중</p>
                    )}
                  </div>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
