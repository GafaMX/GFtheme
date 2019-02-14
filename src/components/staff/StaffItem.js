'use strict';
import React from "react";

class StaffItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={["staff-item", "col-md-4", "staff_" + this.props.staff.id].join(" ")}>
                <div className={["staff-item__container", "mb-4", "card"].join(" ")}>
                    {/* <img className="staff-item-picture" src={this.instructorImage}/> */}
                    <div className={["staff-item__picture"]}>
                        <img className={(this.props.staff.picture_web_list ? 'show' : 'hidden')} src={this.props.staff.picture_web_list}/>
                        <div className={["text-center image-missing " + (this.props.staff.picture_web_list ? 'hidden' : 'show')]}>Image Missing</div>
                    </div>
                    <div className={'card-body'}>
                        <h2 className={["staff-item__name"].join(" ")}>{this.props.staff.name}</h2>
                        <h3 className={["staff-item__lastname"].join(" ")}>{this.props.staff.lastname}</h3>
                        <p className={["staff-item__job"].join(" ")}>{this.props.staff.job}</p>
                        <p className="staff-item__description d-none">{this.props.staff.description}</p>
                    </div>
                </div>
            </div>
        );
    }
}

export default StaffItem;