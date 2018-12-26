'use strict';

import React from "react";

class StaffItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={["staff-item", "col-md-4"].join(" ")}>
                <img className="staff-item-picture" src={this.props.staff.picture_web_list}/>
                <p className="staff-item-name">{this.props.staff.name}</p>
                <p className="staff-item-lastname">{this.props.staff.lastname}</p>
                <p className="staff-item-job">{this.props.staff.job}</p>
                <p className="staff-item-description">{this.props.staff.description}</p>
            </div>
        );
    }
}

export default StaffItem;