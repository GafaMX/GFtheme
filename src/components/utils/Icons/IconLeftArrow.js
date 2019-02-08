import React from "react";

const IconLeftArrow = ({
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
        points="45.7,0.1 47.1,1.6 17.7,31 49.1,62.4 47.7,63.9 14.9,31 "
    />
  </svg>
);

export default IconLeftArrow;