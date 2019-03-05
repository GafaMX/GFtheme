'use strict';

import React from "react";
import {Carousel} from "react-bootstrap";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import 'moment/locale/es';
import UserCredit from "./UserCredit";
import UserMembership from "./UserMembership";

class ProfileCreditsMemberships extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            credits: [],
            memberships: []
        };
    }

    componentDidMount() {
        const currentComponent = this;

        GafaFitSDKWrapper.getUserCredits(function (result) {
            currentComponent.setState({
                credits: result,
            });
        });

        GafaFitSDKWrapper.getUserMemberships(function (result) {
            currentComponent.setState({
                memberships: result,
            })
        });
    }

    render() {
        return (
            <div className={'creditosUser col-md-6'}>
                <Carousel interval={null} indicators={false}>
                    {this.state.credits.map(credit => {
                        return <Carousel.Item key={credit.expiration_date + credit.credits_id}>
                            <UserCredit
                                creditsTotal={credit.total}
                                name={credit.credit.name}
                                expirationDate={credit.expiration_date}/>
                        </Carousel.Item>
                    })}
                    {this.state.memberships.map(membership => {
                        return <Carousel.Item key={membership.memberships_id}>
                            <UserMembership
                                from={membership.created_at}
                                to={membership.expiration_date}
                                name={membership.membership.name}/>
                        </Carousel.Item>
                    })}
                </Carousel>
            </div>
        );
    }
}

export default ProfileCreditsMemberships;