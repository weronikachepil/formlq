"use client";

import { IconBtn, MenuItem } from "./controls";
import type { MenuControl } from "./menu";
import { useBoard } from "./useBoard";

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase();

/** Top-right bar: connection status, participants, students list (owner), follow, export. */
export function PeopleBar({ mc }: { mc: MenuControl }) {
  const { st, b } = useBoard();
  const { menu, toggle, close } = mc;
  const students = st.peers.filter((p) => !p.owner);

  return (
    <div className="bd-people">
      <span className={"bd-status " + st.status} title={st.status === "online" ? "Зʼєднано" : "Немає зʼєднання"} />
      {!st.canEdit && <span className="bd-chip">Лише перегляд</span>}
      {st.peers.slice(0, 6).map((p) => {
        const clickable = st.isOwner && !p.owner;
        return (
          <span
            key={p.cid}
            className={"bd-avatar" + (clickable ? " click" : "")}
            style={{ background: p.color }}
            title={clickable ? `${p.name}: клік — перейти до учня` : p.name}
            onClick={() => {
              if (clickable) toggle("peers");
            }}
          >
            {initial(p.name)}
          </span>
        );
      })}
      {st.isOwner && students.length > 0 && (
        <span className="bd-drop-wrap">
          <button className={"bd-chip-btn" + (menu === "peers" || st.followCid ? " on" : "")} onClick={() => toggle("peers")}>
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
      {st.peers.length > 6 && <span className="bd-chip">+{st.peers.length - 6}</span>}
      {!st.isOwner && (
        <button
          className={"bd-chip-btn" + (st.follow ? " on" : "")}
          title="Ваш екран повторює екран вчителя"
          onClick={() => b()?.setFollow(!st.follow)}
        >
          {st.follow ? "Слідкую за вчителем" : "Слідкувати за вчителем"}
        </button>
      )}
      <span className="bd-drop-wrap">
        <IconBtn name="download" title="Зберегти дошку (PNG / PDF)" active={menu === "export"} onClick={() => toggle("export")} />
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
