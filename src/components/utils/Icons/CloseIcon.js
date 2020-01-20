import React from "react";

const CloseIcon = ({
  style = {},
  fill = "currentColor",
  width = "100%",
  className = "",
  viewBox = "0 0 512 512"
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
    <path fill={fill} d="M285.2,256L505.9,35.3c8.1-8.1,8.1-21.2,0-29.2c-8.1-8.1-21.2-8.1-29.2,0L256,226.8L35.3,6.1C27.2-2,14.1-2,6.1,6.1
    C-2,14.1-2,27.2,6.1,35.3L226.8,256L6.1,476.7c-8.1,8.1-8.1,21.2,0,29.2c4,4,9.3,6.1,14.6,6.1c5.3,0,10.6-2,14.6-6.1L256,285.2
    l220.7,220.7c4,4,9.3,6.1,14.6,6.1c5.3,0,10.6-2,14.6-6.1c8.1-8.1,8.1-21.2,0-29.3L285.2,256z"/>
  </svg>
);

export default CloseIcon;