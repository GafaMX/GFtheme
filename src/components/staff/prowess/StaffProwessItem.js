'use strict';
import React from "react";

export default class StaffProwessItem extends React.Component {
    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(event, brand, slug){
        event.preventDefault()
        window.open(templateUrl + '/equipo/?marca='+ brand +'&miembro=' + slug);
    }

    render() {

        let {currentBrand, staff} = this.props

        return (
            <div className={"qodef-team qodef-item-space info-hover"}>
                <div className={"qodef-team-inner"}>
                    <div className={"qodef-team-position-main"}>
                        <h6 className={"qodef-team-position-main-inner"}>{this.props.staff.job}</h6>
                    </div>
                    <div className={"qodef-team-image"}>
                        <img
                            width="800" height="800" 
                            src={this.props.staff.picture_web_list}
                            className={"attachment-post-thumbnail size-post-thumbnail wp-post-image"}
                            alt="i"
                            // srcset="http://localhost/undercover/wp-content/uploads/2018/02/team-img-1.jpg 800w,
                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-1-150x150.jpg 150w,
                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-1-300x300.jpg 300w,
                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-1-768x768.jpg 768w,
                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-1-550x550.jpg 550w,
                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-1-600x600.jpg 600w,
                            //         http://localhost/undercover/wp-content/uploads/2018/02/team-img-1-100x100.jpg 100w"
                            // sizes="(max-width: 800px) 100vw, 800px"
                        />
                        <div className={"qodef-team-info-tb"}>
                            <div className={"qodef-team-info-tc"}>
                                <div className={"qodef-team-title-holder"}>
                                    <h5 className={"qodef-team-name entry-title"}>
                                        <a onClick={(e) => this.handleClick(e, currentBrand.slug, staff.slug)}>
                                            {staff.name} {staff.lastname}
                                        </a>
                                    </h5>
                                    <h6 className={"qodef-team-position"}>{staff.job}</h6>
                                </div>
                                {/* <div className={"qodef-team-social-holder-between"}>
                                    <div className={"qodef-team-social"}>
                                        <div className={"qodef-team-social-inner"}>
                                            <div className={"qodef-team-social-wrapp"}>
                                                <span className={"qodef-icon-shortcode qodef-normal"}>
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
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div> */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}