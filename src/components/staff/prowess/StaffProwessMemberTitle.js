'use strict';
import React from "react";
import './styles/StaffProwessMember.scss';

export default class StaffProwessMemberTitle extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            member: this.props.member,
        }
    }

    render() {
        let {member} = this.state;
        return (
            <div className={"qodef-title-inner"}>
                <div className={"qodef-grid"}>
                    <h1 className={"qodef-page-title entry-title"}>{member.name} {member.lastname}</h1>
                </div>
            </div>
        );
    }
}