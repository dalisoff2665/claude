import React from "react";
import { Composition, staticFile, getInputProps } from "remotion";
import { Reel } from "./Reel";
import edlDefault from "../../edl.json";

export const RemotionRoot: React.FC = () => {
  const input = getInputProps() as any;
  const edl = input?.edl ?? edlDefault;
  return (
    <Composition
      id="Reel"
      component={Reel as any}
      durationInFrames={Math.round((edl.meta?.duration ?? 45) * 30)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ edl }}
    />
  );
};
