"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";

const MAPS_API_KEY = "AIzaSyAapi6SdaSAzwXhjdmsc8ZYi5pgrsTCGwE";
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#cce8f6" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#1a3a5c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#a8d5ec" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#90c9e8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e0f2fc" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#6bb8dc" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#00B0F0" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
];

interface CrewLocation {
  uid: string;
  displayName: string;
  photoURL: string;
  location: { lat: number; lng: number };
}

interface FriendRequest {
  uid: string;
  displayName: string;
  photoURL: string;
  status: string;
  direction: string;
}

interface CrewProfile {
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
  createdAt: unknown;
}

export default function CrewApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CrewProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postText, setPostText] = useState("");
  const [locSharing, setLocSharing] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [crewLocations, setCrewLocations] = useState<CrewLocation[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<CrewLocation | null>(null);
  const [shareDone, setShareDone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const crewRef = doc(db, "crews", user.uid);
    getDoc(crewRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(crewRef, {
          displayName: user.displayName ?? "크루",
          photoURL: user.photoURL ?? "",
          isLocationVisible: false,
        });
      }
    });
    return onSnapshot(crewRef, (snap) => {
      if (snap.exists()) setProfile(snap.data() as CrewProfile);
    });
  }, [user]);

  // 내 근황 (사이드바용)
  useEffect(() => {
    if (!user) { setPosts([]); return; }
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      setPosts(all.filter((p) => p.uid === user.uid));
    });
  }, [user]);

  // 크루 위치
  useEffect(() => {
    return onSnapshot(collection(db, "crews"), (snap) => {
      const all = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as any))
        .filter((c: any) => c.isLocationVisible && c.location);
      setCrewLocations(all as CrewLocation[]);
    });
  }, []);

  // 전체 피드 (메인 피드용)
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q, (snap) => {
      setFeedPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
    });
  }, []);

  useEffect(() => {
    if (!user) { setFriendRequests([]); return; }
    return onSnapshot(collection(db, "crews", user.uid, "friends"), (snap) => {
      const incoming = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as FriendRequest))
        .filter((f) => f.status === "pending" && f.direction === "received");
      setFriendRequests(incoming);
    });
  }, [user]);

  const acceptFriend = async (fromUid: string) => {
    if (!user) return;
    await updateDoc(doc(db, "crews", user.uid, "friends", fromUid), { status: "accepted" });
    await updateDoc(doc(db, "crews", fromUid, "friends", user.uid), { status: "accepted" });
  };

  const rejectFriend = async (fromUid: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "crews", user.uid, "friends", fromUid));
    await deleteDoc(doc(db, "crews", fromUid, "friends", user.uid));
  };

  const setLocationByAddress = async () => {
    if (!user || !addressInput.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressInput + " 한국")}&key=AIzaSyAapi6SdaSAzwXhjdmsc8ZYi5pgrsTCGwE&language=ko&region=kr`
      );
      const data = await res.json();
      if (data.status === "REQUEST_DENIED") {
        alert("API 키 오류: Geocoding API가 아직 활성화되지 않았거나 키 설정을 확인해주세요.");
      } else if (data.results?.[0]) {
        const { lat, lng } = data.results[0].geometry.location;
        const foundAddr = data.results[0].formatted_address;
        await setDoc(doc(db, "crews", user.uid), {
          location: { lat, lng },
          isLocationVisible: true,
          locationUpdatedAt: serverTimestamp(),
        }, { merge: true });
        setCurrentAddress(foundAddr);
        setAddressInput(foundAddr);
      } else {
        alert(`주소를 찾을 수 없어요.\n상태: ${data.status}\n더 자세히 입력해보세요 (예: 당진 하사로 132)`);
      }
    } catch (e) {
      alert("네트워크 오류가 발생했어요.");
    }
    setGeocoding(false);
  };

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider).catch(() => {});
  };

  const shareLocation = () => {
    if (!user) return;
    setLocSharing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        await setDoc(doc(db, "crews", user.uid), {
          location: loc,
          isLocationVisible: true,
          locationUpdatedAt: serverTimestamp(),
        }, { merge: true });

        // 역지오코딩으로 주소 표시
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&key=AIzaSyAapi6SdaSAzwXhjdmsc8ZYi5pgrsTCGwE&language=ko&region=kr`
          );
          const data = await res.json();
          if (data.results?.[0]) {
            const addr = data.results[0].formatted_address;
            setCurrentAddress(addr);
            setAddressInput(addr);
          } else {
            setCurrentAddress(`위도 ${loc.lat.toFixed(5)}, 경도 ${loc.lng.toFixed(5)}`);
            setAddressInput(`위도 ${loc.lat.toFixed(5)}, 경도 ${loc.lng.toFixed(5)}`);
          }
        } catch {
          setCurrentAddress(`위도 ${loc.lat.toFixed(5)}, 경도 ${loc.lng.toFixed(5)}`);
          setAddressInput(`위도 ${loc.lat.toFixed(5)}, 경도 ${loc.lng.toFixed(5)}`);
        }

        setLocSharing(false);
      },
      () => setLocSharing(false),
      { enableHighAccuracy: true }
    );
  };

  const hideLocation = async () => {
    if (!user) return;
    await setDoc(
      doc(db, "crews", user.uid),
      { isLocationVisible: false },
      { merge: true }
    );
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/babara/profile/?uid=${user?.uid}`;
    if (navigator.share) {
      await navigator.share({ title: "내 GRAPE 프로필", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
    }
    setShareDone(true);
    setTimeout(() => setShareDone(false), 2000);
  };

  const deletePost = async (postId: string) => {
    await deleteDoc(doc(db, "posts", postId));
  };

  const submitPost = async () => {
    const text = postText.trim();
    if (!text || !user) return;
    setPostText("");
    await addDoc(collection(db, "posts"), {
      uid: user.uid,
      displayName: user.displayName ?? "크루",
      photoURL: user.photoURL ?? "",
      text,
      createdAt: serverTimestamp(),
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-slate-300 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* 왼쪽: 브랜딩 */}
        <div className="bg-slate-900 flex flex-col justify-center px-10 py-14 lg:flex-1 lg:py-0">
          {/* b 로고 */}
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-7 shadow-sm">
            <span
              className="text-slate-900 font-bold leading-none select-none"
              style={{ fontSize: 30, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              G
            </span>
          </div>
          <h1 className="text-white text-4xl lg:text-5xl font-bold tracking-tight">GRAPE</h1>
          <p className="text-slate-400 text-base mt-3 leading-relaxed">
            Be the Grape
          </p>
        </div>

        {/* 오른쪽: 로그인 카드 */}
        <div className="bg-white flex items-center justify-center px-8 py-12 lg:flex-1">
          <div className="w-full max-w-sm space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">GRAPE에 로그인</h2>
              <p className="text-sm text-slate-400 mt-1">크루 계정으로 시작하세요</p>
            </div>

            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 시작하기
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-slate-100" />
              <span className="text-xs text-slate-300 shrink-0">또는</span>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            <p className="text-xs text-center text-slate-400 leading-relaxed">
              Google 계정으로 로그인하면<br />크루 프로필이 자동으로 생성돼요
            </p>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      label: "친구",
      href: "/babara/crew/friends/",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "저장됨",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      label: "룸메이트",
      href: "/babara/crew/roommate/",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      label: "지도",
      href: "/babara/map/",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 모바일 드로어 backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 모바일 슬라이드 드로어 */}
      <div className={`md:hidden fixed inset-y-0 left-0 w-4/5 max-w-xs bg-white z-50 overflow-y-auto transform transition-transform duration-300 ease-in-out ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* 드로어 프로필 */}
        <div className="px-4 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-bold text-slate-900">메뉴</span>
            <button onClick={() => setDrawerOpen(false)} className="text-slate-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} className="w-14 h-14 rounded-full" alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-200" />
            )}
            <div>
              <p className="font-bold text-slate-900">{user.displayName}</p>
              <button
                onClick={() => profile?.isLocationVisible ? hideLocation() : shareLocation()}
                disabled={locSharing}
                className="flex items-center gap-1.5 mt-1 disabled:opacity-50"
              >
                <div className={`relative w-8 h-5 rounded-full transition-colors duration-200 ${profile?.isLocationVisible ? "bg-green-500" : "bg-slate-300"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${profile?.isLocationVisible ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </div>
                <span className={`text-xs ${profile?.isLocationVisible ? "text-green-600" : "text-slate-400"}`}>
                  {locSharing ? "..." : profile?.isLocationVisible ? "위치 공유 중" : "위치 비공개"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 드로어 메뉴 아이템 */}
        <div className="py-2">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.href && window.location.assign(item.href); setDrawerOpen(false); }}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700">
                {item.icon}
              </div>
              <span className="text-sm font-medium text-slate-800">{item.label}</span>
            </button>
          ))}

          {/* 내 주소 보내기 */}
          <button
            onClick={() => { shareProfile(); setDrawerOpen(false); }}
            className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-800">
              {shareDone ? "완료!" : "내 주소 보내기"}
            </span>
          </button>

          <div className="border-t border-slate-100 my-2" />

          {/* 설정 및 개인정보 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-800">설정 및 개인정보</span>
            </div>
            <svg viewBox="0 0 24 24" className={`w-4 h-4 text-slate-400 transition-transform ${showSettings ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showSettings && (
            <div className="mx-5 mb-3 p-4 bg-slate-50 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">내 위치 고정</p>

              {/* 주소 입력 */}
              <div className="space-y-2">
                <input
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setLocationByAddress()}
                  placeholder="주소 입력 (예: 홍대입구역 2번 출구)"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-white"
                />
                <button
                  onClick={setLocationByAddress}
                  disabled={!addressInput.trim() || geocoding}
                  className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity"
                >
                  {geocoding ? "위치 찾는 중..." : "이 주소로 위치 고정"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-xs text-slate-400">또는</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* 현재 위치 */}
              <button
                onClick={shareLocation}
                disabled={locSharing}
                className="w-full py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity"
              >
                {locSharing ? "위치 가져오는 중..." : "현재 위치로 고정"}
              </button>

              {/* 역지오코딩 결과 + 수정 */}
              {currentAddress && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-400">감지된 주소 (수정 가능)</p>
                  <input
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setLocationByAddress()}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-slate-500 bg-white"
                  />
                  {addressInput !== currentAddress && (
                    <button
                      onClick={setLocationByAddress}
                      disabled={geocoding}
                      className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-40"
                    >
                      {geocoding ? "수정 중..." : "수정된 주소로 업데이트"}
                    </button>
                  )}
                </div>
              )}

              {profile?.isLocationVisible && (
                <button
                  onClick={hideLocation}
                  className="w-full py-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  위치 공유 끄기
                </button>
              )}
            </div>
          )}

          <div className="border-t border-slate-100 my-2" />

          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-500">로그아웃</span>
          </button>

          {/* 하단 안전 영역 */}
          <div className="h-16" />
        </div>
      </div>

      {/* 상단 네비바 */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-slate-900 h-14 flex items-center px-4 justify-between shadow-md">
        <div className="flex items-center gap-3">
          {/* 모바일 햄버거 */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden text-white p-1"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shrink-0">
            <span
              className="text-slate-900 font-bold leading-none"
              style={{ fontSize: 22, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              G
            </span>
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">GRAPE</span>
        </div>
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700" />
          )}
          <button
            onClick={() => signOut(auth)}
            className="hidden md:block text-xs text-slate-500 hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 바디 */}
      <div className="pt-14 pb-20 md:pb-6 max-w-5xl mx-auto flex gap-4 px-3 py-4">

        {/* 좌측 사이드바 (데스크탑) */}
        <div className="hidden md:flex flex-col w-64 shrink-0 gap-1">
          {/* 내 상태 */}
          <div className="bg-white rounded-xl p-3 shadow-sm mb-1">
            <div className="flex items-center gap-2 mb-2">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-7 h-7 rounded-full shrink-0" alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
              )}
              <span className="text-xs font-semibold text-slate-700">내 상태</span>
            </div>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitPost(); }}
              placeholder="지금 뭐 하고 있나요?"
              rows={postText ? 3 : 2}
              className="w-full text-xs outline-none resize-none placeholder:text-slate-300 text-slate-800 bg-slate-50 rounded-lg px-3 py-2"
            />
            {postText.trim() && (
              <button onClick={submitPost} className="w-full mt-2 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold">
                올리기
              </button>
            )}
          </div>

          {/* 프로필 */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-200 transition-colors">
            {user.photoURL ? (
              <img src={user.photoURL} className="w-9 h-9 rounded-full" alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-300" />
            )}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
              <button
                onClick={() => profile?.isLocationVisible ? hideLocation() : shareLocation()}
                disabled={locSharing}
                className="flex items-center gap-2 disabled:opacity-50"
              >
                <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${profile?.isLocationVisible ? "bg-green-500" : "bg-slate-300"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${profile?.isLocationVisible ? "translate-x-5" : "translate-x-1"}`} />
                </div>
                <span className={`text-xs ${profile?.isLocationVisible ? "text-green-600" : "text-slate-400"}`}>
                  {locSharing ? "가져오는 중..." : profile?.isLocationVisible ? "위치 공유 중" : "위치 비공개"}
                </span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 my-1" />

          {/* 내 주소 보내기 */}
          <button
            onClick={shareProfile}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-700">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-800">
              {shareDone ? "완료! ✓" : "내 주소 보내기"}
            </span>
          </button>

          <div className="border-t border-slate-200 my-1" />

          {navItems.map((item) => (
            <div
              key={item.label}
              onClick={() => item.href && window.location.assign(item.href)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-200 cursor-pointer transition-colors"
            >
              <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-700">
                {item.icon}
              </div>
              <span className="text-sm font-medium text-slate-800">{item.label}</span>
            </div>
          ))}

          <div className="border-t border-slate-200 my-1" />

          {/* 설정 및 개인정보 (데스크탑) */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-800">설정 및 개인정보</span>
            </div>
            <svg viewBox="0 0 24 24" className={`w-4 h-4 text-slate-400 transition-transform ${showSettings ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showSettings && (
            <div className="mx-2 p-3 bg-white rounded-xl shadow-sm space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">내 위치 고정</p>
              <input
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setLocationByAddress()}
                placeholder="주소 입력"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400"
              />
              <button
                onClick={setLocationByAddress}
                disabled={!addressInput.trim() || geocoding}
                className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-40"
              >
                {geocoding ? "찾는 중..." : "이 주소로 고정"}
              </button>
              <button
                onClick={shareLocation}
                disabled={locSharing}
                className="w-full py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium disabled:opacity-40"
              >
                {locSharing ? "가져오는 중..." : "현재 위치로 고정"}
              </button>
              {currentAddress && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-400">감지된 주소 (수정 가능)</p>
                  <input
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setLocationByAddress()}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-slate-500"
                  />
                  {addressInput !== currentAddress && (
                    <button
                      onClick={setLocationByAddress}
                      disabled={geocoding}
                      className="w-full py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-40"
                    >
                      {geocoding ? "수정 중..." : "수정된 주소로 업데이트"}
                    </button>
                  )}
                </div>
              )}
              {profile?.isLocationVisible && (
                <button onClick={hideLocation} className="w-full py-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors">
                  위치 공유 끄기
                </button>
              )}
            </div>
          )}

        </div>

        {/* 메인 피드 */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* 친구 요청 알림 */}
        {friendRequests.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              친구 요청 <span className="text-red-500">{friendRequests.length}</span>
            </p>
            {friendRequests.map((req) => (
              <div key={req.uid} className="flex items-center gap-3">
                {req.photoURL ? (
                  <img src={req.photoURL} className="w-10 h-10 rounded-full shrink-0" alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                )}
                <span
                  className="flex-1 text-sm font-medium text-slate-800 cursor-pointer hover:underline"
                  onClick={() => window.location.assign(`/babara/profile/?uid=${req.uid}`)}
                >
                  {req.displayName}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => acceptFriend(req.uid)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => rejectFriend(req.uid)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

          {/* 지도 (접기 가능) */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 지도 헤더 + 접기 버튼 */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">
                {crewLocations.length > 0 ? `${crewLocations.length}명 활동 중` : "활동 중인 사람 없음"}
              </span>
              <button
                onClick={() => setMapCollapsed(!mapCollapsed)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`w-4 h-4 transition-transform duration-300 ${mapCollapsed ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth={2}
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                {mapCollapsed ? "지도 펼치기" : "접기"}
              </button>
            </div>

            {/* 지도 본체 */}
            <div className={`transition-all duration-300 overflow-hidden ${mapCollapsed ? "max-h-0" : "max-h-[400px]"}`}>
              <LoadScript googleMapsApiKey={MAPS_API_KEY}>
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "340px" }}
                  center={crewLocations.length > 0 ? { lat: crewLocations[0].location.lat, lng: crewLocations[0].location.lng } : DEFAULT_CENTER}
                  zoom={13}
                  options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", styles: MAP_STYLE }}
                >
                  {crewLocations.map((crew) => (
                    <Marker
                      key={crew.uid}
                      position={{ lat: crew.location.lat, lng: crew.location.lng }}
                      onClick={() => setSelectedCrew(crew)}
                    />
                  ))}
                  {selectedCrew && (
                    <InfoWindow
                      position={{ lat: selectedCrew.location.lat, lng: selectedCrew.location.lng }}
                      onCloseClick={() => setSelectedCrew(null)}
                    >
                      <div
                        className="flex items-center gap-2 py-0.5 pr-1 cursor-pointer"
                        onClick={() => window.location.assign(`/babara/profile/?uid=${selectedCrew.uid}`)}
                      >
                        {selectedCrew.photoURL && (
                          <img src={selectedCrew.photoURL} className="w-7 h-7 rounded-full" alt="" referrerPolicy="no-referrer" />
                        )}
                        <span className="text-sm font-medium text-slate-900">{selectedCrew.displayName}</span>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </LoadScript>
            </div>
          </div>

          {/* 모바일 내 상태 작성란 */}
          <div className="md:hidden bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex gap-2 items-center">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-8 h-8 rounded-full shrink-0" alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
              )}
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="내 상태..."
                rows={postText ? 3 : 1}
                className="flex-1 text-sm outline-none resize-none placeholder:text-slate-300 text-slate-800 bg-slate-50 rounded-xl px-3 py-2"
              />
            </div>
            {postText.trim() && (
              <div className="flex justify-end mt-2">
                <button onClick={submitPost} className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold">
                  올리기
                </button>
              </div>
            )}
          </div>

          {/* 전체 피드 */}
          {feedPosts.length === 0 && (
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
              <p className="text-sm text-slate-300">아직 근황이 없어요</p>
            </div>
          )}
          {feedPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                {post.photoURL ? (
                  <img
                    src={post.photoURL}
                    className="w-10 h-10 rounded-full cursor-pointer"
                    alt=""
                    referrerPolicy="no-referrer"
                    onClick={() => window.location.assign(`/babara/profile/?uid=${post.uid}`)}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                )}
                <p
                  className="flex-1 text-sm font-semibold text-slate-900 cursor-pointer hover:underline"
                  onClick={() => window.location.assign(`/babara/profile/?uid=${post.uid}`)}
                >
                  {post.displayName}
                </p>
                {post.uid === user.uid && (
                  <button
                    onClick={() => deletePost(post.id)}
                    className="text-xs text-slate-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{post.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 모바일 하단 네비 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around py-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => item.href && window.location.assign(item.href)}
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-slate-500"
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
