'use strict';

import React from "react";
import StaffProwessMemberContent from "./prowess/StaffProwessMemberContent";
// import StaffDefault from "./default/StaffDefault";

export default class StaffMemberContent extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            staff: this.props.staff.list,
        };
    }

    template() {
        let {staffMember} = this.props;

        var member =
        this.state.staff.find((member) => {
            return member.slug === staffMember
        });

        let template = this.props.template;
        if (template === null || template === ''){
            template = template
        } else {
            template = template.toUpperCase();
        }

        switch(template) {
          case 'PROWESS':
            return <StaffProwessMemberContent member={member} theme={this.props.theme} />;
          case null:
            return <StaffDefaultMembers staff={this.props.staff} theme={this.props.theme} />;
          default:
            return <StaffDefaultMembers staff={this.props.staff} theme={this.props.theme} />;
        }
    }

    getClassTemplate() {
        let template = this.props.template;
        if (template === null || template === ''){
            template = template
        } else {
            template = template.toUpperCase();
        }

        switch(template) {
          case 'PROWESS':
            return "qodef-container-inner clearfix";
          case null:
            return '';
          default:
            return '';
        }
    }


    render() {
        return (
            <div className={this.getClassTemplate()}>
                {this.template()}
            </div>
        );
    }
}