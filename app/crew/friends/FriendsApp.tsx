"use client";

import React, { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Friend {
  id: string;
  displayName: string;
  photoURL: string;
  status: "pending" | "accepted";
  direction: "sent" | "received";
}

export default function FriendsApp() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
      else window.location.assign("/babara/crew/");
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    const friendsRef = collection(db, "crews", uid, "friends");
    return onSnapshot(query(friendsRef), (snapshot) => {
      const data: Friend[] = [];
      snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Friend));
      setFriends(data);
      setLoading(false);
    });
  }, [uid]);

  const handleAccept = async (friend: Friend) => {
    if (!uid) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "crews", uid, "friends", friend.id), { status: "accepted" });
    batch.update(doc(db, "crews", friend.id, "friends", uid), { status: "accepted" });
    await batch.commit();
  };

  const handleRejectOrDelete = async (friendId: string) => {
    if (!uid) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, "crews", uid, "friends", friendId));
    batch.delete(doc(db, "crews", friendId, "friends", uid));
    await batch.commit();
  };

  const pendingRequests = friends.filter((f) => f.status === "pending" && f.direction === "received");
  const activeFriends = friends.filter((f) => f.status === "accepted");

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
        <span className="text-white font-semibold text-sm">친구 관리</span>
      </div>

      <div className="pt-14 max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <p className="text-sm text-slate-400 text-center py-10">불러오는 중...</p>
        )}

        {/* 받은 요청 */}
        {!loading && pendingRequests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              받은 요청 ({pendingRequests.length})
            </h2>
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-1">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => window.location.assign(`/babara/profile/?uid=${req.id}`)}
                >
                  {req.photoURL ? (
                    <img src={req.photoURL} className="w-10 h-10 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                  )}
                  <span className="text-sm font-semibold text-slate-800">{req.displayName}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req)}
                    className="bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => handleRejectOrDelete(req.id)}
                    className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 친구 목록 */}
        {!loading && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              모든 친구 ({activeFriends.length})
            </h2>
            {activeFriends.length === 0 ? (
              <p className="text-sm text-slate-300 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                아직 친구가 없어요
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeFriends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => window.location.assign(`/babara/profile/?uid=${friend.id}`)}
                    >
                      {friend.photoURL ? (
                        <img src={friend.photoURL} className="w-10 h-10 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200" />
                      )}
                      <span className="text-sm font-semibold text-slate-800">{friend.displayName}</span>
                    </div>
                    <button
                      onClick={() => handleRejectOrDelete(friend.id)}
                      className="text-xs text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
