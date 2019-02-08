import React from "react";

const IconRightArrow = ({
  style = {},
  fill = "currentColor",
  width = "100%",
  className = "",
  viewBox = "0 0 64 64"
}) => (
  <svg
    width={width}
    style={style}
    height={width}
    viewBox={viewBox}
    xmlns="http://www.w3.org/2000/svg"
    className={`svg-icon ${className || ""}`}
    xmlnsXlink="http://www.w3.org/1999/xlink"
  >
    <polygon 
        fill={fill}
        points="18.3,63.9 16.9,62.4 46.3,33 14.9,1.6 16.3,0.1 49.1,33 "
    />
  </svg>
);

export default IconRightArrow;