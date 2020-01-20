import React from "react";

const RightArrowIcon = ({
  style = {},
  fill = "#000",
  width = "100%",
  className = "",
  viewBox = "0 0 59.414 59.414"
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
    <polygon points="15.561,0 14.146,1.414 42.439,29.707 14.146,58 15.561,59.414 45.268,29.707 "/>
  </svg>
);

export default RightArrowIcon;