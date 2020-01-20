'use strict';
import React from "react";
import './styles/StaffProwessMember.scss';

export default class StaffProwessMemberContent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            member: this.props.member,
        }
    }

    render() {
        let {member} = this.state;
        return (
            <div className={"qodef-team-single-holder"}>
                <div className={"qodef-grid-row"}>
                    <div className={"qodef-page-content-holder qodef-grid-col-12"}>
                        <div className={"qodef-team-single-outer"}>
                            <div className={"qodef-team-single-info-holder"}>
                                <div className={"qodef-grid-row"}>
                                    <div className={"qodef-ts-image-holder qodef-grid-col-6"}>
                                        <img width="800" height="800" 
                                            src={member.picture_web}
                                            className={"attachment-post-thumbnail size-post-thumbnail wp-post-image"} alt="i" 
                                            // srcset="http://localhost/undercover/wp-content/uploads/2018/02/team-img-2.jpg 800w, 
                                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-2-150x150.jpg 150w, 
                                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-2-300x300.jpg 300w, 
                                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-2-768x768.jpg 768w, 
                                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-2-550x550.jpg 550w, 
                                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-2-600x600.jpg 600w, 
                                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-2-100x100.jpg 100w" 
                                            // sizes="(max-width: 800px) 100vw, 800px"
                                            />
                                    </div>
                                    <div className={"qodef-ts-details-holder qodef-grid-col-6"}>
                                        <h3 className={"qodef-name entry-title"}>{member.name} {member.lastname}</h3>
                                        <p className={"qodef-position"}>{member.job}
                                            {/* <span className={"qodef-icon-shortcode qodef-normal"}>
                                                <a href="https://www.facebook.com/" target="_blank">
                                                    <span aria-hidden="true" className={"qodef-icon-font-elegant social_facebook qodef-icon-element"}></span>
                                                </a>
                                            </span>
                                            <span className={"qodef-icon-shortcode qodef-normal"}>
                                                <a href="https://twitter.com/" target="_blank">
                                                    <span aria-hidden="true" className={"qodef-icon-font-elegant social_twitter qodef-icon-element"}></span>
                                                </a>
                                            </span>
                                            <span className={"qodef-icon-shortcode qodef-normal"}>
                                                <a href="https://www.instagram.com/" target="_blank">
                                                    <span aria-hidden="true" className={"qodef-icon-font-elegant social_instagram qodef-icon-element"}></span>
                                                </a>
                                            </span> */}
                                        </p>
                                        <div className={"qodef-ts-bio-holder"}></div>
                                    </div>
                                </div>
                            </div>
                            <div className={"qodef-team-single-content"}>
                                <p>{member.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}