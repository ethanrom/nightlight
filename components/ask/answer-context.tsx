"use client";

import { createContext, useContext } from "react";

/**
 * What a card needs to know about the answer it sits in. The markdown `components` map must stay referentially
 * stable (otherwise every streamed token would remount every card), so this travels through context instead.
 */
export interface AnswerCtxValue {
  /** this answer is still arriving */
  streaming: boolean;
  /** 1-based line of a card fence that has not closed yet (the one that gets a skeleton), or null */
  openLine: number | null;
  /** the newest answer in the conversation */
  isLatest: boolean;
  /** a request is in flight: buttons that send a message are disabled */
  busy: boolean;
  /** send a message as the parent */
  send: (text: string) => void;
}

const Ctx = createContext<AnswerCtxValue>({
  streaming: false,
  openLine: null,
  isLatest: false,
  busy: false,
  send: () => {},
});

export const AnswerProvider = Ctx.Provider;
export const useAnswer = () => useContext(Ctx);
