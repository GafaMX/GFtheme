import React from "react";

const Check = ({
                   style = {},
                   fill = "#000",
                   width = "100%",
                   className = "",
                   viewBox = "0 0 512 512",
                   onClick = () => {
                   }
               }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        width={width}
        style={style}
        height={width}
        className={`svg-icon ${className || ""}`}
        onClick={onClick}
    >
        <path
            fill={fill}
            d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"/>
    </svg>
);

export default Check