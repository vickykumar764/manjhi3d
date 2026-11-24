import React from "react";
import { Composition } from "remotion";
import { ManjhiShort, TOTAL, FPS } from "./manjhi/Manjhi";
import { BridgeShort, BRIDGE_FRAMES } from "./bridge/Bridge";
import { Manjhi2Short, MANJHI2_FRAMES } from "./manjhi2/Manjhi2";
import { BridgeHindiShort, BRIDGE_HINDI_FRAMES } from "./series/bridge/BridgeHindi";
import { PayengHindiShort, PAYENG_FRAMES } from "./series/payeng/PayengHindi";
import { JaswantHindiShort, JASWANT_FRAMES } from "./series/jaswant/JaswantHindi";
import { HivreHindiShort, HIVRE_FRAMES } from "./series/hivre/HivreHindi";

export const Root: React.FC = () => (
  <>
    <Composition id="ManjhiShort" component={ManjhiShort} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
    <Composition id="BridgeRef" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Manjhi2" component={Manjhi2Short} durationInFrames={MANJHI2_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="BridgeHindi" component={BridgeHindiShort} durationInFrames={BRIDGE_HINDI_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="PayengHindi" component={PayengHindiShort} durationInFrames={PAYENG_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="JaswantHindi" component={JaswantHindiShort} durationInFrames={JASWANT_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="HivreHindi" component={HivreHindiShort} durationInFrames={HIVRE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
