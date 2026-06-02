"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";

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

interface Message {
  id: string;
  text: string;
  tableNumber: string;
  createdAt: unknown;
}

export default function GuestApp() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") ?? "";
  const tableNumber = searchParams.get("table") ?? "";

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    signInAnonymously(auth).catch(() => {});
  }, []);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "rooms", roomId)).then((snap) => {
      if (snap.exists()) setRoom(snap.data() as Room);
      setLoading(false);
    });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "asc"),
      limit(100)
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
  }, [roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const totalAmount =
    room?.menus.reduce(
      (sum, m) => sum + (quantities[m.id] ?? 0) * m.price,
      0
    ) ?? 0;
  const hasOrder = totalAmount > 0;

  const submitOrder = async (paymentMethod: "toss" | "account") => {
    if (!room || !hasOrder) return;
    const items = room.menus
      .filter((m) => (quantities[m.id] ?? 0) > 0)
      .map((m) => ({ id: m.id, name: m.name, price: m.price, qty: quantities[m.id] }));

    await addDoc(collection(db, "rooms", roomId, "orders"), {
      tableNumber,
      items,
      totalAmount,
      status: "pending",
      paymentMethod,
      createdAt: serverTimestamp(),
    });

    if (paymentMethod === "toss" && room.paymentInfo.tossId) {
      window.open(
        `https://toss.me/${room.paymentInfo.tossId}/${totalAmount}`,
        "_blank"
      );
    }

    setQuantities({});
    setShowModal(false);
    setOrderDone(true);
    setTimeout(() => setOrderDone(false), 4000);
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !roomId) return;
    setChatInput("");
    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text,
      tableNumber: tableNumber || "?",
      createdAt: serverTimestamp(),
    });
  };

  if (!roomId || !tableNumber) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-slate-400 text-sm">테이블 QR 코드를 스캔해주세요</p>
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

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-slate-400 text-sm">존재하지 않는 주점입니다</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-white mx-auto"
      style={{ maxWidth: 448, height: "100dvh" }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <span className="font-semibold text-slate-900 text-sm">{room.name}</span>
        <span className="text-xs text-slate-400">{tableNumber}번 테이블</span>
      </div>

      {/* 주문 영역 */}
      <div className="flex flex-col border-b border-slate-100" style={{ flex: "0 0 50%" }}>
        <div className="flex-1 overflow-y-auto px-4 pt-3 space-y-1">
          {room.menus.map((menu) => (
            <div
              key={menu.id}
              className="flex items-center justify-between py-2"
            >
              <div>
                <span className="text-sm font-medium text-slate-800">
                  {menu.name}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  {menu.price.toLocaleString()}원
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setQuantities((q) => ({
                      ...q,
                      [menu.id]: Math.max(0, (q[menu.id] ?? 0) - 1),
                    }))
                  }
                  className="w-7 h-7 rounded-full border border-slate-200 text-slate-500 text-sm flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm text-slate-900 tabular-nums">
                  {quantities[menu.id] ?? 0}
                </span>
                <button
                  onClick={() =>
                    setQuantities((q) => ({
                      ...q,
                      [menu.id]: (q[menu.id] ?? 0) + 1,
                    }))
                  }
                  className="w-7 h-7 rounded-full border border-slate-200 text-slate-500 text-sm flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 shrink-0">
          {orderDone && (
            <div className="mb-2 text-center text-xs text-green-600 bg-green-50 py-2 rounded-lg">
              주문이 접수되었습니다 ✓
            </div>
          )}
          <button
            onClick={() => hasOrder && setShowModal(true)}
            disabled={!hasOrder}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
              hasOrder
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {hasOrder
              ? `주문하기 · ${totalAmount.toLocaleString()}원`
              : "메뉴를 선택해주세요"}
          </button>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-2 shrink-0">
          <span className="text-xs text-slate-400">주점 로비 · 익명 채팅</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
          {messages.length === 0 && (
            <p className="text-xs text-slate-300 text-center pt-4">
              첫 번째 메시지를 남겨보세요
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="text-sm leading-relaxed">
              <span className="text-slate-400 text-xs">{msg.tableNumber}번</span>
              <span className="text-slate-700 ml-2">{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="px-3 py-3 border-t border-slate-100 flex gap-2 shrink-0">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="익명 메시지..."
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-white"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg shrink-0"
          >
            전송
          </button>
        </div>
      </div>

      {/* 결제 모달 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full p-6 space-y-4"
            style={{ maxWidth: 448 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-slate-900">결제 및 주문 접수</h2>

            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
              {room.menus
                .filter((m) => (quantities[m.id] ?? 0) > 0)
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex justify-between text-sm text-slate-600"
                  >
                    <span>
                      {m.name} × {quantities[m.id]}
                    </span>
                    <span>
                      {(m.price * (quantities[m.id] ?? 0)).toLocaleString()}원
                    </span>
                  </div>
                ))}
              <div className="border-t border-slate-200 pt-2 mt-1 flex justify-between font-semibold text-slate-900">
                <span>합계</span>
                <span>{totalAmount.toLocaleString()}원</span>
              </div>
            </div>

            <p className="text-xs text-center text-slate-400">
              송금 메모에{" "}
              <strong className="text-slate-600">
                &quot;{tableNumber}번 테이블&quot;
              </strong>
              을 입력해주세요
            </p>

            {room.paymentInfo.tossId && (
              <button
                onClick={() => submitOrder("toss")}
                className="w-full py-3 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: "#3182F6" }}
              >
                토스로 결제하기
              </button>
            )}

            {room.paymentInfo.accountNo && (
              <div className="space-y-2">
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">은행</span>
                    <span>{room.paymentInfo.accountBank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">계좌번호</span>
                    <span>{room.paymentInfo.accountNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">예금주</span>
                    <span>{room.paymentInfo.accountName}</span>
                  </div>
                </div>
                <button
                  onClick={() => submitOrder("account")}
                  className="w-full py-3 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium"
                >
                  계좌이체 후 주문 접수
                </button>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2 text-slate-400 text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
