import React, { useState } from "react";

export type Tab = {
  title: string;
  value: string;
  content?: string | React.ReactNode;
};

export function Tabs({
  tabs: propTabs,
  containerClassName = "",
  activeTabClassName = "",
  tabClassName = "",
  contentClassName = "",
}: {
  tabs: Tab[];
  containerClassName?: string;
  activeTabClassName?: string;
  tabClassName?: string;
  contentClassName?: string;
}) {
  const [active, setActive] = useState<Tab>(propTabs[0]);

  const activeIndex = propTabs.findIndex((t) => t.value === active.value);

  return (
    <div className={`tabs-root-container ${containerClassName}`}>
      {/* Tabs Navigation Header */}
      <div className="tabs-nav-bar">
        {propTabs.map((tab) => {
          const isActive = active.value === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActive(tab)}
              className={`tab-btn-item ${isActive ? "active" : ""} ${isActive ? activeTabClassName : ""} ${tabClassName}`}
            >
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs Content Stack with 3D Perspective Depth */}
      <div className={`tabs-content-stage ${contentClassName}`}>
        {propTabs.map((tab, idx) => {
          const isActive = active.value === tab.value;
          const diff = idx - activeIndex;
          const isVisible = Math.abs(diff) <= 2;

          return (
            <div
              key={tab.value}
              className={`tab-content-card ${isActive ? "card-active" : "card-stacked"}`}
              style={{
                zIndex: isActive ? 20 : 10 - Math.abs(diff),
                opacity: isActive ? 1 : isVisible ? 0.35 / Math.abs(diff) : 0,
                pointerEvents: isActive ? "auto" : "none",
                transform: isActive
                  ? "translate3d(0, 0, 0) scale(1)"
                  : `translate3d(0, ${diff * 14}px, -${Math.abs(diff) * 50}px) scale(${1 - Math.abs(diff) * 0.05})`,
              }}
            >
              {tab.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
