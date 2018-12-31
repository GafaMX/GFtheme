'use strict';

import React from "react";

class StaffItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={["staff-item-container", "col-md-4"].join(" ")}>
                <div className={["staff-item", "mb-4", "card", "shadow-sm"].join(" ")}>
                    <img className="staff-item-picture" src={this.props.staff.picture_web_list}/>
                    <h3 className={["font-weight-normal", "staff-item-name"].join(" ")}>{this.props.staff.name}</h3>
                    <h3 className={["font-weight-normal", "staff-item-lastname"].join(" ")}>{this.props.staff.lastname}</h3>
                    <h5 className={["font-weight-normal", "staff-item-job"].join(" ")}>{this.props.staff.job}</h5>
                    <p className="staff-item-description">{this.props.staff.description}</p>
                </div>
            </div>
        );
    }
}

export default StaffItem;