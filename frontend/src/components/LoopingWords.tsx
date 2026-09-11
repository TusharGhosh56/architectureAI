import React, { useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";

interface LoopingWordsProps {
  words: string[];
}

export const LoopingWords: React.FC<LoopingWordsProps> = ({ words }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const wordListRef = useRef<HTMLUListElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const totalWords = words.length;
  const wordHeight = 100 / totalWords;
  let currentIndex = 0;

  const moveWords = useCallback(() => {
    const wordList = wordListRef.current;
    if (!wordList) return;

    currentIndex++;

    gsap.to(wordList, {
      yPercent: -wordHeight * currentIndex,
      duration: 1.1,
      ease: "elastic.out(1, 0.85)",
      onComplete: function () {
        if (currentIndex >= totalWords - 3) {
          if (wordList.children.length > 0) {
            wordList.appendChild(wordList.children[0]);
            currentIndex--;
            gsap.set(wordList, { yPercent: -wordHeight * currentIndex });
          }
        }
      },
    });
  }, [wordListRef, wordHeight, totalWords]);

  useEffect(() => {
    timelineRef.current = gsap.timeline({ repeat: -1, delay: 1.2 });
    timelineRef.current
      .call(moveWords)
      .to({}, { duration: 2.2 });

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [moveWords]);

  return (
    <span className="looping-words-wrapper" ref={containerRef}>
      <span className="looping-words">
        <span className="looping-words__containers">
          <ul className="looping-words__list" ref={wordListRef}>
            {words.map((word, index) => (
              <li key={index} className="looping-words__item">
                <span className="looping-words__text">{word}</span>
              </li>
            ))}
          </ul>
        </span>

        {/* Top/bottom soft gradient mask */}
        <span className="looping-words__fade" aria-hidden="true" />
      </span>
    </span>
  );
};

export default LoopingWords;
