'use strict';
import React from "react";

class StaffItem extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let structureClass = preE + '-structure';
        let staffClass = preC + '-staffList';

        return (
            <div className={staffClass + '__item ' + structureClass}>
                <div className={structureClass + '__head'}>
                    <div className={["this-image"]}>
                        <img className={(this.props.staff.picture_web_list ? 'show' : 'hidden')} src={this.props.staff.picture_web_list}/>
                        <div className={["text-center image-missing " + (this.props.staff.picture_web_list ? 'hidden' : 'show')]}>Image Missing</div>
                    </div>
                </div>
                <div className={structureClass + '__body'}>
                    <h2 className={'this-name'}>{this.props.staff.name} {this.props.staff.lastname}</h2>
                    <p className={'this-job'}>{this.props.staff.job}</p>
                </div>
                <div className={structureClass + '__footer'}>
                    <p className={'this-description'}>{this.props.staff.description}</p>
                </div>
            </div>
        );
    }
}

export default StaffItem;