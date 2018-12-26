'use strict';

import React from "react";
import StaffItem from "./StaffItem";

class StaffList extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const listItems = this.props.list.map((staff) =>
            <StaffItem key={staff.id} staff={staff}/>
        );
        return (
            <div className={["staff-list", "container"].join(" ")}>
                <div className={["row"].join(" ")}>
                    {listItems}
                </div>
            </div>
        );
    }
}

export default StaffList;