import React from "react";

export default function AnalysisLoader() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12">
      <div className="relative h-24 w-32 flex items-center justify-center">
        <div className="typewriter-alt">
          <div className="slide">
            <i />
          </div>
          <div className="paper" />
          <div className="keyboard" />
        </div>
      </div>
      <div className="mt-4 text-sm font-medium text-neutral-500">
        AI 분석관이 최근 경기를 분석 중입니다.
      </div>
      <style>
        {`
          .typewriter-alt {
            --green: rgb(161, 94, 255);
            --green-dark: #0a0962;
            --key: #e0e0e0;
            --paper: #f5f5f5;
            --text: #b0bec5;
            --tool: #ffca28;
            --duration: 2.5s;
            position: relative;
            animation: bounce-alt var(--duration) ease-in-out infinite;
          }

          .typewriter-alt .slide {
            width: 100px;
            height: 18px;
            border-radius: 4px;
            margin-left: 10px;
            transform: translateX(10px);
            background: linear-gradient(var(--green), var(--green-dark));
            animation: slide-alt var(--duration) ease infinite;
          }

          .typewriter-alt .slide:before,
          .typewriter-alt .slide:after,
          .typewriter-alt .slide i:before {
            content: "";
            position: absolute;
            background: var(--tool);
          }

          .typewriter-alt .slide:before {
            width: 3px;
            height: 10px;
            top: 4px;
            left: 100%;
          }

          .typewriter-alt .slide:after {
            left: 102px;
            top: 2px;
            height: 12px;
            width: 5px;
            border-radius: 2px;
          }

          .typewriter-alt .slide i {
            display: block;
            position: absolute;
            right: 100%;
            width: 5px;
            height: 5px;
            top: 3px;
            background: var(--tool);
          }

          .typewriter-alt .slide i:before {
            right: 100%;
            top: -3px;
            width: 3px;
            border-radius: 1px;
            height: 12px;
          }

          .typewriter-alt .paper {
            position: absolute;
            left: 20px;
            top: -30px;
            width: 45px;
            height: 50px;
            border-radius: 6px;
            background: var(--paper);
            transform: translateY(50px);
            animation: paper-alt var(--duration) linear infinite;
          }

          .typewriter-alt .paper:before {
            content: "";
            position: absolute;
            left: 5px;
            right: 5px;
            top: 8px;
            border-radius: 1px;
            height: 3px;
            transform: scaleY(0.9);
            background: var(--text);
            box-shadow:
              0 10px 0 var(--text),
              0 20px 0 var(--text),
              0 30px 0 var(--text);
          }

          .typewriter-alt .keyboard {
            width: 130px;
            height: 60px;
            margin-top: -8px;
            z-index: 1;
            position: relative;
          }

          .typewriter-alt .keyboard:before,
          .typewriter-alt .keyboard:after {
            content: "";
            position: absolute;
          }

          .typewriter-alt .keyboard:before {
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 8px;
            background: linear-gradient(135deg, var(--green), var(--green-dark));
            transform: perspective(12px) rotateX(3deg);
            transform-origin: 50% 100%;
          }

          .typewriter-alt .keyboard:after {
            left: 3px;
            top: 28px;
            width: 10px;
            height: 3px;
            border-radius: 1px;
            box-shadow:
              16px 0 0 var(--key),
              32px 0 0 var(--key),
              48px 0 0 var(--key),
              64px 0 0 var(--key),
              80px 0 0 var(--key),
              96px 0 0 var(--key),
              24px 8px 0 var(--key),
              40px 8px 0 var(--key),
              56px 8px 0 var(--key),
              64px 8px 0 var(--key),
              72px 8px 0 var(--key),
              88px 8px 0 var(--key);
            animation: keyboard-alt var(--duration) linear infinite;
          }

          @keyframes bounce-alt {
            0%,
            80%,
            100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-6px);
            }
            60% {
              transform: translateY(3px);
            }
          }

          @keyframes slide-alt {
            0%,
            100% {
              transform: translateX(10px);
            }
            25% {
              transform: translateX(4px);
            }
            50% {
              transform: translateX(-2px);
            }
            75% {
              transform: translateX(-8px);
            }
          }

          @keyframes paper-alt {
            0%,
            100% {
              transform: translateY(50px);
            }
            25% {
              transform: translateY(40px);
            }
            50% {
              transform: translateY(25px);
            }
            75% {
              transform: translateY(10px);
            }
          }

          @keyframes keyboard-alt {
            0%,
            20%,
            40%,
            60%,
            80% {
              box-shadow:
                16px 0 0 var(--key),
                32px 0 0 var(--key),
                48px 0 0 var(--key),
                64px 0 0 var(--key),
                80px 0 0 var(--key),
                96px 0 0 var(--key),
                24px 8px 0 var(--key),
                40px 8px 0 var(--key),
                56px 8px 0 var(--key),
                64px 8px 0 var(--key),
                72px 8px 0 var(--key),
                88px 8px 0 var(--key);
            }
            10% {
              box-shadow:
                16px 2px 0 var(--key),
                32px 0 0 var(--key),
                48px 0 0 var(--key),
                64px 0 0 var(--key),
                80px 0 0 var(--key),
                96px 0 0 var(--key),
                24px 8px 0 var(--key),
                40px 8px 0 var(--key),
                56px 8px 0 var(--key),
                64px 8px 0 var(--key),
                72px 8px 0 var(--key),
                88px 8px 0 var(--key);
            }
            30% {
              box-shadow:
                16px 0 0 var(--key),
                32px 0 0 var(--key),
                48px 0 0 var(--key),
                64px 2px 0 var(--key),
                80px 0 0 var(--key),
                96px 0 0 var(--key),
                24px 8px 0 var(--key),
                40px 8px 0 var(--key),
                56px 8px 0 var(--key),
                64px 8px 0 var(--key),
                72px 8px 0 var(--key),
                88px 8px 0 var(--key);
            }
            50% {
              box-shadow:
                16px 0 0 var(--key),
                32px 0 0 var(--key),
                48px 0 0 var(--key),
                64px 0 0 var(--key),
                80px 0 0 var(--key),
                96px 0 0 var(--key),
                24px 10px 0 var(--key),
                40px 8px 0 var(--key),
                56px 8px 0 var(--key),
                64px 8px 0 var(--key),
                72px 8px 0 var(--key),
                88px 8px 0 var(--key);
            }
            70% {
              box-shadow:
                16px 0 0 var(--key),
                32px 0 0 var(--key),
                48px 0 0 var(--key),
                64px 0 0 var(--key),
                80px 2px 0 var(--key),
                96px 0 0 var(--key),
                24px 8px 0 var(--key),
                40px 8px 0 var(--key),
                56px 8px 0 var(--key),
                64px 8px 0 var(--key),
                72px 8px 0 var(--key),
                88px 8px 0 var(--key);
            }
          }
        `}
      </style>
    </div>
  );
}
