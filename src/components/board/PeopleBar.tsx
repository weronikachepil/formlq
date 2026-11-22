"use client";

import { IconBtn, MenuItem } from "./controls";
import type { MenuControl } from "./menu";
import { useBoard } from "./useBoard";

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase();
const STATUS_TEXT = { online: "Зʼєднано", connecting: "Підключення…", offline: "Немає зʼєднання" } as const;

/** Top-right bar: connection status, participants, students list (owner), follow, export. */
export function PeopleBar({ mc }: { mc: MenuControl }) {
  const { st, b } = useBoard();
  const { menu, toggle, close } = mc;
  const students = st.peers.filter((p) => !p.owner);

  return (
    <div className="bd-people">
      <span className={"bd-status " + st.status} role="status" aria-label={STATUS_TEXT[st.status]} title={STATUS_TEXT[st.status]} />
      {/* Not just a coloured dot: a lost connection mid-lesson is said in words. */}
      {st.status === "offline" && <span className="bd-chip warn">Немає зʼєднання</span>}
      {!st.canEdit && <span className="bd-chip">Лише перегляд</span>}
      {st.peers.slice(0, 6).map((p) => {
        const clickable = st.isOwner && !p.owner;
        if (!clickable) {
          return (
            <span key={p.cid} className="bd-avatar" style={{ background: p.color }} title={p.name}>
              {initial(p.name)}
            </span>
          );
        }
        return (
          <button
            key={p.cid}
            className="bd-avatar click"
            style={{ background: p.color }}
            title={`${p.name}: де зараз учень`}
            aria-label={`${p.name}: де зараз учень`}
            onClick={() => toggle("peers")}
          >
            {initial(p.name)}
          </button>
        );
      })}
      {st.peers.length > 6 && <span className="bd-chip">+{st.peers.length - 6}</span>}
      {st.isOwner && students.length > 0 && (
        <span className="bd-drop-wrap">
          <button
            className={"bd-chip-btn" + (menu === "peers" || st.followCid ? " on" : "")}
            aria-haspopup="menu"
            aria-expanded={menu === "peers"}
            onClick={() => toggle("peers")}
          >
            Учні ({students.length})
          </button>
          {menu === "peers" && (
            <div className="bd-menu bd-drop" style={{ width: 340 }}>
              <div className="bd-menu-title">Де зараз учні</div>
              {students.map((p) => (
                <div key={p.cid} className="bd-peer">
                  <span className="bd-avatar" style={{ background: p.color }}>
                    {initial(p.name)}
                  </span>
                  <span className="bd-peer-name">
                    <b title={p.name}>{p.name}</b>
                    <small>{st.pages.find((x) => x.id === p.pg)?.name || (p.pg ? "…" : "аркуш ще не відомий")}</small>
                  </span>
                  <span className="bd-peer-actions">
                    <button
                      className="bd-chip-btn"
                      onClick={() => {
                        b()?.goToPeer(p.cid);
                        close();
                      }}
                    >
                      Перейти
                    </button>
                    <button
                      className={"bd-chip-btn" + (st.followCid === p.cid ? " on" : "")}
                      title="Ваш екран повторюватиме екран учня, поки ви не зміните його самі"
                      onClick={() => {
                        b()?.followPeer(p.cid);
                        close();
                      }}
                    >
                      {st.followCid === p.cid ? "Слідкую" : "Слідкувати"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </span>
      )}
      {!st.isOwner && (
        <button
          className={"bd-chip-btn" + (st.follow ? " on" : "")}
          title="Ваш екран повторює екран вчителя"
          aria-pressed={st.follow}
          onClick={() => b()?.setFollow(!st.follow)}
        >
          {st.follow ? "Слідкую за вчителем" : "Слідкувати за вчителем"}
        </button>
      )}
      <span className="bd-drop-wrap">
        <IconBtn name="download" title="Зберегти дошку (PNG / PDF)" active={menu === "export"} menu onClick={() => toggle("export")} />
        {menu === "export" && (
          <div className="bd-menu bd-drop">
            <MenuItem
              icon="png"
              title="PNG"
              desc="Лише поточний аркуш"
              onClick={() => {
                close();
                b()?.exportAs("png");
              }}
            />
            <MenuItem
              icon="pdf"
              title="PDF"
              desc="Усі аркуші дошки"
              onClick={() => {
                close();
                b()?.exportAs("pdf");
              }}
            />
          </div>
        )}
      </span>
    </div>
  );
}
