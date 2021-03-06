import * as React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface VideoData {
  name: string;
  resolutions: Array<number>;
  duration: number;
}

interface VideoStreamProps {
}

const VideoStream: React.FC<VideoStreamProps> = (props) => {
  const [ videos, setVideos ] = useState<Array<VideoData>>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/videos", { method: "GET" });

      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    })();
  }, []);

  return (
    <>
      <h1 className="title">Videos</h1>
      {videos.map((v, i) => {
        return (
          <div key={i} className="box">
            <Link to={`/video/${v.name}`}>{v.name}</Link>
            <hr/>
            <b>Available resolutions:</b> {v.resolutions.join(", ")}<br/>
            <b>Duration:</b> {v.duration}s
          </div>
        );
      })}
    </>
  );
};

export default VideoStream;
