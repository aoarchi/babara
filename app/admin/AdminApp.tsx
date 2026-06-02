"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface Room {
  name: string;
  menus: MenuItem[];
  paymentInfo: {
    tossId?: string;
    accountBank?: string;
    accountNo?: string;
    accountName?: string;
  };
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "completed";
  createdAt: unknown;
}

export default function AdminApp() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") ?? "";

  const [room, setRoom] = useState<Room | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  const [setupName, setSetupName] = useState("");
  const [setupMenus, setSetupMenus] = useState([
    { name: "김치전", price: "5000" },
    { name: "제육볶음", price: "6000" },
    { name: "소주", price: "4000" },
    { name: "맥주", price: "4000" },
  ]);
  const [setupTossId, setSetupTossId] = useState("");
  const [setupBank, setSetupBank] = useState("");
  const [setupAccountNo, setSetupAccountNo] = useState("");
  const [setupAccountName, setSetupAccountName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "rooms", roomId)).then((snap) => {
      if (snap.exists()) {
        setRoom(snap.data() as Room);
      } else {
        setShowSetup(true);
      }
      setLoading(false);
    });
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !room) return;
    const q = query(
      collection(db, "rooms", roomId, "orders"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
    });
  }, [roomId, room]);

  const createRoom = async () => {
    if (!setupName || !roomId) return;
    setSaving(true);
    const menus = setupMenus
      .filter((m) => m.name && m.price)
      .map((m, i) => ({ id: `menu-${i}`, name: m.name, price: parseInt(m.price) }));

    const roomData: Room = {
      name: setupName,
      menus,
      paymentInfo: {
        tossId: setupTossId || undefined,
        accountBank: setupBank || undefined,
        accountNo: setupAccountNo || undefined,
        accountName: setupAccountName || undefined,
      },
    };

    await setDoc(doc(db, "rooms", roomId), { ...roomData, createdAt: serverTimestamp() });
    setRoom(roomData);
    setShowSetup(false);
    setSaving(false);
  };

  const confirmPayment = (orderId: string) =>
    updateDoc(doc(db, "rooms", roomId, "orders", orderId), { status: "confirmed" });

  const completeOrder = (orderId: string) =>
    updateDoc(doc(db, "rooms", roomId, "orders", orderId), { status: "completed" });

  if (!roomId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-slate-400 text-sm">URL에 ?room=방코드 를 추가해주세요</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-slate-300 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className="max-w-md mx-auto p-6 pb-12 space-y-5">
        <div>
          <h1 className="font-semibold text-xl text-slate-900">주점 개설</h1>
          <p className="text-xs text-slate-400 mt-1">방 코드: {roomId}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            주점 이름
          </label>
          <input
            value={setupName}
            onChange={(e) => setSetupName(e.target.value)}
            placeholder="예: 컴퓨터공학과 주점"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-400"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            메뉴
          </label>
          {setupMenus.map((menu, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={menu.name}
                onChange={(e) => {
                  const u = [...setupMenus];
                  u[i] = { ...u[i], name: e.target.value };
                  setSetupMenus(u);
                }}
                placeholder="메뉴명"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <input
                value={menu.price}
                onChange={(e) => {
                  const u = [...setupMenus];
                  u[i] = { ...u[i], price: e.target.value };
                  setSetupMenus(u);
                }}
                placeholder="가격"
                type="number"
                className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
          ))}
          <button
            onClick={() => setSetupMenus([...setupMenus, { name: "", price: "" }])}
            className="w-full py-2 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg"
          >
            + 메뉴 추가
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            결제 정보
          </label>
          <input
            value={setupTossId}
            onChange={(e) => setSetupTossId(e.target.value)}
            placeholder="토스 아이디 (선택, toss.me/아이디)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <input
            value={setupBank}
            onChange={(e) => setSetupBank(e.target.value)}
            placeholder="은행명 (예: 카카오뱅크)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <input
            value={setupAccountNo}
            onChange={(e) => setSetupAccountNo(e.target.value)}
            placeholder="계좌번호"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <input
            value={setupAccountName}
            onChange={(e) => setSetupAccountName(e.target.value)}
            placeholder="예금주"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
          />
        </div>

        <button
          onClick={createRoom}
          disabled={!setupName || saving}
          className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-medium disabled:bg-slate-200 disabled:text-slate-400"
        >
          {saving ? "저장 중..." : "주점 개설하기"}
        </button>
      </div>
    );
  }

  const pending = orders.filter((o) => o.status === "pending");
  const confirmed = orders.filter((o) => o.status === "confirmed");
  const completed = orders.filter((o) => o.status === "completed");

  return (
    <div className="max-w-lg mx-auto p-4 pb-12 space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-semibold text-lg text-slate-900">{room?.name}</h1>
        <span className="text-xs text-slate-400">
          {pending.length > 0 ? `${pending.length}건 대기 중` : "대기 없음"}
        </span>
      </div>

      {/* 입금 대기 */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            입금 대기
          </p>
          {pending.map((order) => (
            <div
              key={order.id}
              className="border-2 border-red-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="animate-pulse w-2 h-2 rounded-full bg-red-400 inline-block" />
                  <span className="font-medium text-slate-900">
                    {order.tableNumber}번 테이블
                  </span>
                </div>
                <span className="font-semibold text-slate-900">
                  {order.totalAmount.toLocaleString()}원
                </span>
              </div>
              <div className="text-sm text-slate-500 space-y-0.5">
                {order.items.map((item, i) => (
                  <div key={i}>
                    {item.name} × {item.qty}
                  </div>
                ))}
              </div>
              <button
                onClick={() => confirmPayment(order.id)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium"
              >
                입금 확인 →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 조리 중 */}
      {confirmed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            조리 중
          </p>
          {confirmed.map((order) => (
            <div
              key={order.id}
              className="border border-green-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  <span className="font-medium text-slate-900">
                    {order.tableNumber}번 테이블
                  </span>
                </div>
                <span className="font-semibold text-slate-900">
                  {order.totalAmount.toLocaleString()}원
                </span>
              </div>
              <div className="text-sm text-slate-500 space-y-0.5">
                {order.items.map((item, i) => (
                  <div key={i}>
                    {item.name} × {item.qty}
                  </div>
                ))}
              </div>
              <button
                onClick={() => completeOrder(order.id)}
                className="w-full py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium"
              >
                서빙 완료
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 완료 */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-300 uppercase tracking-wide">
            완료
          </p>
          {completed.map((order) => (
            <div
              key={order.id}
              className="border border-slate-100 rounded-xl p-3 flex items-center justify-between opacity-40"
            >
              <span className="text-sm text-slate-500">
                {order.tableNumber}번 테이블
              </span>
              <span className="text-sm text-slate-400">
                {order.totalAmount.toLocaleString()}원
              </span>
            </div>
          ))}
        </div>
      )}

      {orders.length === 0 && (
        <div className="text-center py-16 text-slate-300 text-sm">
          아직 주문이 없습니다
        </div>
      )}
    </div>
  );
}
