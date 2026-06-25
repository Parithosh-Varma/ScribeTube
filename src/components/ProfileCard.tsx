"use client";

import React from "react";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
const GithubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

export function ProfileCard() {
  return (
    <CardContainer className="inter-var">
      <CardBody className="bg-gray-50 relative group/card dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-black dark:border-white/[0.2] border-black/[0.1] w-auto sm:w-[30rem] h-auto rounded-xl p-6 border">
        <CardItem
          translateZ="50"
          className="text-xl font-bold text-neutral-600 dark:text-white"
        >
          Parithosh-Varma
        </CardItem>
        <CardItem
          as="p"
          translateZ="60"
          className="text-neutral-500 text-sm max-w-sm mt-2 dark:text-neutral-300"
        >
          Developer who builds tools that bridge the gap between raw data and human-readable content.
        </CardItem>
        <CardItem translateZ="100" className="w-full mt-4">
          <div className="flex items-center gap-4">
            <img
              src="https://avatars.githubusercontent.com/u/277201506?v=4"
              height="100"
              width="100"
              className="h-24 w-24 rounded-full object-cover group-hover/card:shadow-xl"
              alt="Parithosh-Varma"
            />
            <img
              src="/logo.png"
              height="100"
              width="100"
              className="h-24 w-24 object-contain group-hover/card:shadow-xl"
              alt="ScribeTube"
            />
          </div>
        </CardItem>
        <div className="flex justify-between items-center mt-20">
          <CardItem
            translateZ={20}
            as="a"
            href="https://github.com/Parithosh-Varma"
            target="_blank"
            className="px-4 py-2 rounded-xl text-xs font-normal dark:text-white flex items-center gap-2"
          >
            <GithubIcon /> GitHub →
          </CardItem>
          <CardItem
            translateZ={20}
            as="a"
            href="https://web-production-52ca6.up.railway.app/"
            target="_blank"
            className="px-4 py-2 rounded-xl bg-black dark:bg-white dark:text-black text-white text-xs font-bold"
          >
            Try ScribeTube
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
}
