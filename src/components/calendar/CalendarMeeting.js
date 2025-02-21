'use strict';

import React from "react";
import CalendarStorage from "./CalendarStorage";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import moment from 'moment';
import 'moment/locale/es';
import StringStore from "../utils/Strings/StringStore";
import Check from "../icons/Check";

class CalendarMeeting extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            openFancy: false,
            showTooltip: false,
        }
    }


    handleClick(event) {
        event.preventDefault();
        let currentElement = this;
        let login_initial = this.props.login_initial;

        GafaFitSDKWrapper.isAuthenticated(function (auth) {
            if (auth) {
                currentElement.showBuyFancyForLoggedUsers();
            } else {
                login_initial ? currentElement.showLoginForNotLoggedUsers() : currentElement.showRegisterForNotLoggedUsers();
                /*currentElement.showRegisterForNotLoggedUsers();*/
            }
        });
    };

    showBuyFancyForLoggedUsers() {
        let comp = this;
        let meeting = this.props.meeting;

        comp.setState({
            openFancy: true,
        });

        const fancy = document.querySelector('[data-gf-theme="fancy"]');
        fancy.classList.add('active');

        setTimeout(function () {
            fancy.classList.add('show');
        }, 400);

        if (meeting) {

            GafaFitSDKWrapper.getFancyForMeetingReservation(
                meeting.location.brand.slug,
                meeting.location.slug,
                meeting.id,
                function (result) {
                    getFancy();

                    function getFancy() {
                        if (document.querySelector('[data-gf-theme="fancy"]').firstChild) {
                            const closeFancy = document.getElementById('CreateReservationFancyTemplate--Close');

                            closeFancy.addEventListener('click', function (e) {
                                var event_before = new Event('buq__reservation_fancy_before_closed');
                                dispatchEvent(event_before);
                                fancy.removeChild(document.querySelector('[data-gf-theme="fancy"]').firstChild);

                                fancy.classList.remove('show');

                                setTimeout(function () {
                                    fancy.classList.remove('active');
                                    fancy.innerHTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';
                                }, 400);

                                comp.setState({
                                    openFancy: false,
                                })
                            })
                        } else {
                            setTimeout(getFancy, 1000);
                        }
                    }
                }
            );
        }
    }

    showLoginForNotLoggedUsers() {
        window.GFtheme.meetings_id = this.props.meeting.id;
        window.GFtheme.location_slug = this.props.meeting.location.slug;
        window.GFtheme.brand_slug = this.props.meeting.location.brand.slug;
        let login = CalendarStorage.get('show_login');
        login(true);
    }

    showRegisterForNotLoggedUsers() {
        window.GFtheme.meetings_id = this.props.meeting.id;
        window.GFtheme.location_slug = this.props.meeting.location.slug;
        window.GFtheme.brand_slug = this.props.meeting.location.brand.slug;
        let register = CalendarStorage.get('show_register');
        register(true);
    }

    printDescription() {
        let show_description = CalendarStorage.get('show_description');
        let meeting = this.props.meeting;

        if (show_description) {
            return (
                <p className={'this-description'}>
                    {meeting.description}
                </p>
            );
        }

        return null;
    }

    printStaff() {
        let {meeting} = this.props;
        let staff = meeting.staff;
        const coachExtraInfo = meeting.extra_fields && meeting.extra_fields.coachExtraInfo;


        if (staff && staff.hasOwnProperty('job') && staff.job !== null) {
            return (
                <p className={'this-staff'}>{staff.job} {coachExtraInfo ? ` / ${coachExtraInfo}` : ''}</p>
            )
        } else {
            return (
                <p className={'this-staff'}>{meeting.staff.name} {meeting.staff.lastname} {coachExtraInfo ? ` / ${coachExtraInfo}` : ''}</p>
            );
        }
    }

    printSubstituteStaff() {
        let {meeting} = this.props;
        let substitute_staff = meeting.substitute_staff;

        if (substitute_staff) {
            if (substitute_staff.hasOwnProperty('job') && substitute_staff.job !== null) {
                return (
                    <p className={'this-substitute-staff'}>{StringStore.get('SUBSTITUTE_INDICATOR')} {substitute_staff.job}</p>
                );
            } else {
                return (
                    <p className={'this-substitute-staff'}>{StringStore.get('SUBSTITUTE_INDICATOR')} {substitute_staff.name} {substitute_staff.lastname}</p>
                );
            }
        }

        return null;
    }

    showTooltip(e) {
        e.preventDefault();
        e.stopPropagation();
        let {showTooltip} = this.state;
        console.log(showTooltip);

        this.setState({
            showTooltip: !showTooltip
        });
    }

    render() {
        let {meeting, visualization} = this.props;
        let {openFancy, showTooltip} = this.state;
        let day = this.props.day;
        let classStart = moment(meeting.start_date).toDate();
        let time_format = meeting.location.brand.time_format;
        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let calendarClass = preC + '-Calendar';
        let meetingClass = preE + '-meeting';
        let no_availability_display = meeting.location.brand.no_availability_display ? meeting.location.brand.no_availability_display : 'default';
        let show_parent = CalendarStorage.get('show_parent');
        let parent_service = meeting.service.parent_service_recursive;

        return (
            <div key={`column-day--${day.date}--meeting--${meeting.id}`}
                 style={{pointerEvents: openFancy ? 'none' : 'auto'}}
                 className={calendarClass + '__item ' + meetingClass + (meeting.passed ? ' has-pasted' : '') + ` ${meeting.available > 0 ? '' : 'no-availability'}` + ` ${no_availability_display !== 'default' ? no_availability_display : ''}`}
                 data-id={meeting.id}
                 onClick={openFancy ? null : this.handleClick.bind(this)}>
                <div className={meetingClass + '__header'}>
                    {time_format === '12'
                        ?
                        <p className={'this-time'}>{moment(classStart).format('hh')}.{moment(classStart).format('mm')} {moment(classStart).format('a')}</p>
                        :
                        <p className={'this-time'}>{moment(classStart).format('kk')}.{moment(classStart).format('mm')} </p>
                    }
                </div>

                <hr></hr>
                <div className={meetingClass + '__body'}>
                    <p className={'this-availability'}>{StringStore.get('AVAILABILITY')}: {meeting.available} / {meeting.capacity}</p>
                    {this.printStaff()}
                    {this.printSubstituteStaff()}
                    {show_parent && parent_service ? (
                        <p className={'this-parent-service'}>{parent_service.name}</p>) : null}
                    <p className={'this-service'}>{meeting.service.name}</p>
                    <p className={'this-location'}>{meeting.location.name}</p>
                    {this.printDescription()}
                    {meeting.is_reserved === 1 ? (
                        <div className={meetingClass + '__reserved_mark'}>
                            <Check
                                width={'15px'}
                                className={meetingClass + '__reserved_mark__icon'}
                                onClick={this.showTooltip.bind(this)}
                            />
                            <input
                                type={'checkbox'}
                                hidden={true}
                                className={meetingClass + '__reserved_mark__checkbox'}
                                checked={showTooltip}
                                onChange={this.showTooltip.bind(this)}
                            />
                            <div
                                className={meetingClass + '__reserved_mark__tooltip' + (showTooltip ? ' showTooltip' : '')}>
                                {StringStore.get('CALENDAR_ALREADY_RESERVED')}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
}

export default CalendarMeeting;