'use strict';

import React from "react";
import StaffItem from "./StaffItem";
import Strings from "../utils/Strings/Strings_ES";

class StaffList extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const listItems = this.props.list.map((staff) =>
            <StaffItem key={staff.id} staff={staff}/>
        );
        return (
            <div>
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.STAFF_LIST}</h1>
                <div className={["staff-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}
                    </div>
                </div>
            </div>
        );
    }
}

export default StaffList;