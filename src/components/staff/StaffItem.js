'use strict';
import React from "react";

class StaffItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
        }

        this.changeItemState = this.changeItemState.bind(this);
    }

    changeItemState(){
        let { active } = this.state;
        if( !active ) {
            this.setState({
                active: true
            })
        } else {
            this.setState({
                active: false
            })
        }
    }

    render() {
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let structureClass = preE + '-structure';
        let staffClass = preC + '-staffList';

        let {active} = this.state;

        return (
            <div className={staffClass + '__item ' + structureClass + (active ? ' is-active' : '')} onClick={this.changeItemState}>
                <div className={structureClass + '__background'}>
                    <img className={(this.props.staff.picture_web_list ? 'show' : 'hidden')} src={this.props.staff.picture_web_list}/>
                </div>
                <div className={structureClass + '__container'}>
                    <div className={structureClass + '__head'}>
                        <div className={["this-image"]}>
                            <div>
                                <img className={(this.props.staff.picture_web_list ? 'show' : 'hidden')} src={this.props.staff.picture_web_list}/>
                                <div className={["text-center image-missing " + (this.props.staff.picture_web_list ? 'hidden' : 'show')]}><p>Image Missing</p></div>
                            </div>
                        </div>
                        <div className={'this-name'}>
                            <h2>{this.props.staff.name} {this.props.staff.lastname}</h2>
                        </div>
                    </div>

                    {/* <div className={structureClass + '__body'}>
                        <p className={'this-job'}>{this.props.staff.job}</p>
                    </div>*/}
                    <div className={structureClass + '__footer'}>
                        <p className={'this-description'}>{this.props.staff.description}</p>
                    </div> 
                </div>
            </div>
        );
    }
}

export default StaffItem;