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
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";

const MAPS_API_KEY = "AIzaSyAapi6SdaSAzwXhjdmsc8ZYi5pgrsTCGwE";
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const mapContainerStyle = { width: "100%", height: "260px" };
const mapOptions = { disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy" };

const ADMIN_EMAIL = "yongwoogwon@gmail.com";

interface Room {
  id: string;
  name: string;
}

interface Crew {
  uid: string;
  displayName: string;
  photoURL: string;
  isLocationVisible: boolean;
  location?: { lat: number; lng: number };
}

interface Order {
  id: string;
  tableNumber: string;
  totalAmount: number;
  status: "pending" | "confirmed" | "completed";
  items: { name: string; qty: number }[];
  paymentMethod?: string;
}

interface Message {
  id: string;
  text: string;
  tableNumber: string;
  createdAt: unknown;
}

export default function SuperAdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomOrders, setRoomOrders] = useState<Record<string, Order[]>>({});
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState<"orders" | "chat">("orders");
  const [crews, setCrews] = useState<Crew[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // 전체 방 구독
  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    return onSnapshot(collection(db, "rooms"), (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Room)));
    });
  }, [user]);

  // 크루 위치 구독
  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    return onSnapshot(collection(db, "crews"), (snap) => {
      const all = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as Crew));
      setCrews(all.filter((c) => c.location));
    });
  }, [user]);

  // 방별 주문 구독
  useEffect(() => {
    if (!rooms.length) return;
    const unsubs = rooms.map((room) =>
      onSnapshot(
        query(collection(db, "rooms", room.id, "orders"), orderBy("createdAt", "desc")),
        (snap) => {
          setRoomOrders((prev) => ({
            ...prev,
            [room.id]: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)),
          }));
        }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [rooms]);

  // 선택된 방의 채팅 구독
  useEffect(() => {
    if (!selectedRoom) { setMessages([]); return; }
    const q = query(
      collection(db, "rooms", selectedRoom.id, "messages"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
  }, [selectedRoom]);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const deleteMessage = (messageId: string) => {
    if (!selectedRoom) return;
    deleteDoc(doc(db, "rooms", selectedRoom.id, "messages", messageId));
  };

  // 전체 통계
  const allOrders = Object.values(roomOrders).flat();
  const totalSales = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPending = allOrders.filter((o) => o.status === "pending").length;
  const totalConfirmed = allOrders.filter((o) => o.status === "confirmed").length;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-slate-300 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-6">
        <div className="text-center space-y-1">
          <p className="font-semibold text-slate-900">Super Admin</p>
          <p className="text-xs text-slate-400">관리자 Google 계정으로 로그인하세요</p>
        </div>
        <button
          onClick={signIn}
          className="flex items-center gap-2.5 px-5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google로 로그인
        </button>
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <p className="text-slate-500 text-sm">접근 권한이 없습니다</p>
        <button
          onClick={() => signOut(auth)}
          className="text-xs text-slate-400 underline"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="font-semibold text-slate-900 text-sm">Super Admin</span>
        <button onClick={() => signOut(auth)} className="text-xs text-slate-400">
          로그아웃
        </button>
      </div>

      {/* 전체 통계 */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4 border-b border-slate-100">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">총 매출</p>
          <p className="text-base font-bold text-slate-900">
            {totalSales.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-0.5">원</span>
          </p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">입금 대기</p>
          <p className="text-base font-bold text-red-500">{totalPending}건</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">조리 중</p>
          <p className="text-base font-bold text-green-600">{totalConfirmed}건</p>
        </div>
      </div>

      {/* 크루 지도 */}
      <div className="border-b border-slate-100">
        <div className="flex items-center justify-between px-4 py-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">크루 위치</p>
          <span className="text-xs text-slate-400">{crews.filter(c => c.isLocationVisible).length}명 공유 중</span>
        </div>
        <LoadScript googleMapsApiKey={MAPS_API_KEY}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={crews.find(c => c.location) ? { lat: crews.find(c => c.location)!.location!.lat, lng: crews.find(c => c.location)!.location!.lng } : DEFAULT_CENTER}
            zoom={12}
            options={mapOptions}
          >
            {crews.map((crew) =>
              crew.location ? (
                <Marker
                  key={crew.uid}
                  position={{ lat: crew.location.lat, lng: crew.location.lng }}
                  onClick={() => setSelectedCrew(crew)}
                />
              ) : null
            )}
            {selectedCrew?.location && (
              <InfoWindow
                position={{ lat: selectedCrew.location.lat, lng: selectedCrew.location.lng }}
                onCloseClick={() => setSelectedCrew(null)}
              >
                <div className="flex items-center gap-2 py-0.5 pr-1">
                  {selectedCrew.photoURL ? (
                    <img src={selectedCrew.photoURL} className="w-7 h-7 rounded-full" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{selectedCrew.displayName}</p>
                    <p className="text-xs text-slate-400">{selectedCrew.isLocationVisible ? "공유 중" : "비공개"}</p>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </div>

      {/* 방 목록 */}
      <div className="px-4 py-4 space-y-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          전체 방 ({rooms.length})
        </p>
        {rooms.length === 0 && (
          <p className="text-xs text-slate-300 text-center py-6">개설된 방이 없습니다</p>
        )}
        {rooms.map((room) => {
          const orders = roomOrders[room.id] ?? [];
          const sales = orders.reduce((s, o) => s + o.totalAmount, 0);
          const pending = orders.filter((o) => o.status === "pending").length;
          const isSelected = selectedRoom?.id === room.id;

          return (
            <button
              key={room.id}
              onClick={() => {
                setSelectedRoom(isSelected ? null : room);
                setTab("orders");
              }}
              className={`w-full text-left border rounded-xl p-4 transition-colors ${
                isSelected
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-900">{room.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{room.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-slate-900">
                    {sales.toLocaleString()}원
                  </span>
                  {pending > 0 && (
                    <span className="ml-2 text-xs text-red-500 font-medium">
                      대기 {pending}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-1.5">
                <span className="text-xs text-slate-400">총 {orders.length}건</span>
                <span className="text-xs text-green-600">
                  완료 {orders.filter((o) => o.status === "completed").length}건
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 선택된 방 상세 */}
      {selectedRoom && (
        <div className="px-4 pb-12 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("orders")}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === "orders"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              주문 내역
            </button>
            <button
              onClick={() => setTab("chat")}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === "chat"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              채팅 ({messages.length})
            </button>
          </div>

          {tab === "orders" && (
            <div className="space-y-2">
              {(roomOrders[selectedRoom.id] ?? []).length === 0 && (
                <p className="text-xs text-slate-300 text-center py-6">주문 없음</p>
              )}
              {(roomOrders[selectedRoom.id] ?? []).map((order) => (
                <div
                  key={order.id}
                  className={`border rounded-xl p-3 space-y-1 ${
                    order.status === "pending"
                      ? "border-red-200"
                      : order.status === "confirmed"
                      ? "border-green-200"
                      : "border-slate-100 opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">
                      {order.tableNumber}번 테이블
                    </span>
                    <span className="text-xs font-semibold text-slate-900">
                      {order.totalAmount.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {order.items?.map((i) => `${i.name}×${i.qty}`).join(", ")}
                    </span>
                    <span
                      className={`text-xs ${
                        order.status === "pending"
                          ? "text-red-400"
                          : order.status === "confirmed"
                          ? "text-green-500"
                          : "text-slate-300"
                      }`}
                    >
                      {order.status === "pending"
                        ? "입금대기"
                        : order.status === "confirmed"
                        ? "조리중"
                        : "완료"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "chat" && (
            <div className="space-y-2">
              {messages.length === 0 && (
                <p className="text-xs text-slate-300 text-center py-6">메시지 없음</p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start justify-between border border-slate-100 rounded-xl px-3 py-2.5 gap-3"
                >
                  <div className="min-w-0">
                    <span className="text-xs text-slate-400">{msg.tableNumber}번</span>
                    <p className="text-sm text-slate-700 mt-0.5 leading-relaxed break-words">
                      {msg.text}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="shrink-0 text-xs text-slate-300 hover:text-red-400 transition-colors pt-0.5"
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
  );
}
