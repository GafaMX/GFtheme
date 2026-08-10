'use strict';

import React from "react";
// import CustomScroll from "react-custom-scroll";
import "react-custom-scroll/dist/customScroll.css"
import {FormErrors} from "../../form/FormErrors";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import moment from "moment";
import {isFunction} from "../../utils/TypeUtils";
import UserInfo from "./UserInfo";
import AddressInfo from "./AddressInfo";
import ContactInfo from "./ContactInfo";
import FutureClasses from "./FutureClasses";
import PastClasses from "../PastClasses";

import ProfileCreditsMemberships from "./ProfileCreditsMemberships";
// import PaymentMethods from "./Payment/PaymentMethods";
import PurchasesList from "../PurchasesList";
import ChangePassword from "./ChangePassword";
import IconLogOut from '../../utils/Icons/IconLogOut';
import IconSelectDownArrow from "../../utils/Icons/IconSelectDownArrow";
// import CloseIcon from "../../utils/Icons/CloseIcon";
// import CheckIcon from "../../utils/Icons/CheckIcon";
import GlobalStorage from '../../store/GlobalStorage';
import MediaQuery from 'react-responsive';

import 'moment/locale/es';
//Estilos
import '../../../styles/newlook/components/GFSDK-c-Profile.scss';
import '../../../styles/newlook/components/GFSDK-c-Orders.scss';
import '../../../styles/newlook/components/GFSDK-c-Payment.scss';
import '../../../styles/newlook/components/GFSDK-c-Tabs.scss';
import '../../../styles/newlook/elements/GFSDK-e-form.scss';
import '../../../styles/newlook/elements/GFSDK-e-scroll.scss';
import '../../../styles/newlook/elements/GFSDK-e-buttons.scss';
import StringStore from "../../utils/Strings/StringStore";
import Loading from "../../common/Loading";
import StoreCredit from "./StoreCredit";
import FutureWaitlist from "./FutureWaitlist";

class ProfileUserInfo extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            email: "",
            first_name: "",
            last_name: "",
            // birthDate: new Date(),
            birth_date: "",
            password: "",
            password_confirmation: "",
            address: "",
            internal_number: "",
            external_number: "",
            municipality: "",
            postal_code: "",
            city: "",
            countries_id: "",
            country_states_id: "",
            countries: [],
            states: [],
            phone: "",
            cel_phone: "",
            gender: "",
            formErrors: {first_name: ''},
            first_nameValid: true,
            formValid: true,
            serverError: '',
            saved: false,
            screen: "classes",
            totals_page: null,
            picture: null,
            '_delete-picture': false,
            // paymentNotification: GlobalStorage.get('ConektaPaymentNotification'),
        };

        this.handleChangeScreen = this.handleChangeScreen.bind(this);
        this.transformStateToForm = this.transformStateToForm.bind(this);
        // GlobalStorage.addSegmentedListener(['ConektaPaymentNotification'], this.updateConektaNotificaction.bind(this));
    }

    static defaultProps() {
        return {
            combineWaitlist: false,
        }
    }

    componentDidMount() {
        const currentComponent = this;
        GafaFitSDKWrapper.getMe(function (result) {
            let birth_date = result.birth_date ? moment(result.birth_date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
            currentComponent.setState(
                {
                    email: result.email,
                    first_name: result.first_name,
                    last_name: result.last_name,
                    // birthDate: new Date(result.birth_date.substring(0, 11)),
                    birth_date: birth_date,
                    address: result.address,
                    internal_number: result.internal_number,
                    external_number: result.external_number,
                    municipality: result.municipality,
                    postal_code: result.postal_code,
                    city: result.city,
                    countries_id: result.countries_id,
                    country_states_id: result.country_states_id,
                    phone: result.phone,
                    cel_phone: result.cel_phone,
                    gender: result.gender,
                    picture: result.picture
                });
            // GlobalStorage.set('me', result);
            currentComponent.getCountryList(currentComponent.getStatesListByCountry.bind(currentComponent));
        });

        GafaFitSDKWrapper.getMeWithPurchase(
            function (result) {
                GafaFitSDKWrapper.getUserStoreCredit((store_data) => {
                    if (store_data && store_data.hasOwnProperty('store_credit')) {
                        result['store_credit_total'] = store_data.store_credit;
                    } else {
                        result['store_credit_total'] = 0;
                    }

                    GlobalStorage.set("me", result, () => {
                        GafaFitSDKWrapper.getUserTotalsPage(function (totals_result) {
                            let user = GlobalStorage.get('me');
                            user.totals_page = totals_result;

                            GlobalStorage.set('me', user, () => {
                                currentComponent.setState({
                                    totals_page: totals_result
                                }, currentComponent.getFutureClasses);
                            });
                        });
                    });
                });

            }
        );
    }

    getFutureClasses() {
        let brands = GlobalStorage.get('brands');
        let futureClassesList = [];
        let lang = StringStore.getLanguage();

        brands.forEach(function (brand) {
            GafaFitSDKWrapper.getUserFutureReservationsInBrand(
                brand.slug,
                {
                    reducePopulation: true,
                    locale: lang,
                },
                function (result) {
                    futureClassesList = futureClassesList.concat(result);
                    GlobalStorage.set('future_classes', futureClassesList);
                });
        });
    }

    // updateConektaNotificaction(){
    //     let currentComponent = this;
    //     currentComponent.setState({
    //         paymentNotification: GlobalStorage.get('ConektaPaymentNotification'),
    //     });
    // }


    findCountryCodeById() {
        let country = this.state.countries.find(option => option.value === this.state.countries_id);
        let countryCode = "";
        if (country != null) {
            countryCode = country.code;
        }
        return countryCode;
    }

    getCountryList(callback) {
        const currentComponent = this;
        GafaFitSDKWrapper.getCountries(function (result) {
            currentComponent.setState(
                {
                    countries: result.map(function (item) {
                        return {label: item.name, value: item.id, code: item.code}
                    }),
                });
            if (isFunction(callback)) callback();
        });
    }

    getStatesListByCountry(callback) {
        const currentComponent = this;
        let countrySelected = currentComponent.findCountryCodeById();
        GafaFitSDKWrapper.getCountryStates(countrySelected, function (result) {
            currentComponent.setState({
                states: result.map(function (item) {
                    return {label: item.name, value: item.id}
                })
            });
            if (isFunction(callback)) callback();
        });
    }

    handleChangeField(event) {
        let fieldName = event.target.id;
        let fieldValue = event.target.value;
        this.setState({
            [fieldName]: fieldValue
        });
    }

    /**
     *
     * @param event
     */
    handleChangeScreen(event) {
        let screenVal = event.target.id;

        this.setState({
            screen: screenVal,
        })
    }

    handleChangePassword(event) {
        let passvalue = event.target.value;

        this.setState({
            password: passvalue,
        })
    }

    handleChangeConfirmationPassword(event) {
        let passvalue = event.target.value;

        this.setState({
            password_confirmation: passvalue
        })
    }

    updateState(state) {
        this.setState(state);
    }

    transformStateToForm() {
        let formData = new FormData();
        let state = this.state;
        let {screen} = this.state;
        Object.entries(state).forEach(([key, value]) => {
            if (key !== 'countries' && key !== 'states' && key !== 'formErrors' && key !== 'first_nameValid' && key !== 'formValid' && key !== 'serverError' && key !== 'saved' && key !== 'screen' && key !== 'totals_page') {
                if (screen === 'password') {
                    if (key === 'password' ||
                        key === 'password_confirmation' ||
                        key === 'email' ||
                        key === 'first_name'
                    ) {
                        formData.append(key, value === null ? '' : value);
                    }
                } else {
                    if (key !== 'password' && key !== 'password_confirmation') {
                        formData.append(key, value === null ? '' : value);
                    }
                }
            }
        });

        return formData;
    }

    handleSubmit(event) {
        event.preventDefault();
        let currentElement = this;
        currentElement.setState({serverError: '', saved: false});
        let formData = this.transformStateToForm();
        GafaFitSDKWrapper.putMe(formData,
            currentElement.successSaveMeCallback.bind(this),
            currentElement.errorSaveMeCallback.bind(this));
    }

    successSaveMeCallback(result) {
        this.setState({saved: true});

        if (this.props.successCallback) {
            this.props.successCallback(result);
        }
    }

    selectFilter(e) {
        let name = e.target.getAttribute('data-name');
        let origin = e.target.getAttribute('data-origin');
        let id = e.target.value;
        let model = null;
        if (id && id !== '')
            model = GlobalStorage.find(origin, id);

        GlobalStorage.set(name, model);
    }

    // deleteCard(){
    //     let ConektaPaymentNotification = GlobalStorage.get('ConektaPaymentNotification');
    //     GafaFitSDKWrapper.postUserRemovePaymentOption(
    //         ConektaPaymentNotification.paymentMethod,
    //         ConektaPaymentNotification.cardID,
    //         function(result){
    //             GlobalStorage.set('ConektaPaymentInfo', result.conekta);
    //         }
    //     );
    // }

    // closeNotification(){
    //     GlobalStorage.set('ConektaPaymentNotification', null);
    // }

    errorSaveMeCallback(error) {
        this.setState({serverError: error});
    }

    printFutureWaitlist(profileClass) {
        let {combineWaitlist} = this.props;

        if (!combineWaitlist) {
            return (
                <div className={profileClass + '__tab-section'}>
                    <h4 className={'this-title'}>{StringStore.get('PROFILE_NEXT_WAITLIST_CLASSES')}</h4>
                    <FutureWaitlist/>
                </div>
            )
        }

        return null;
    }

    render() {
        let preE = 'GFSDK-e';
        let preC = 'GFSDK-c';
        let profileClass = preC + '-profile';
        let paymentClass = preC + '-payment';
        let tabsClass = preC + '-tabs';
        let buttonClass = preE + '-buttons';
        let formClass = preE + '-form';
        let filterClass = preC + '-filter';
        let filter_name = 'meetings-calendar--filters';
        let locations = GlobalStorage.get('locations');
        let me = GlobalStorage.get("me");
        let brands = GlobalStorage.get('brands');
        let {paymentNotification, screen, totals_page} = this.state;
        let {combineWaitlist} = this.props;

        return (
            <div className="profile-info">
                <div className={'GFSDK-user__container'}>
                    <div className="profile-user">
                        <div className="profile-user__content">
                            <div className="profile-user__data">
                                {/* <div className="this-picture"></div> */}
                                <h3 className="profile-user__name">{StringStore.get('PROFILE_USER_GREETING', [this.state.first_name])}
                                    <br></br> {StringStore.get('PROFILE_WELCOME')}
                                </h3>
                                {/* <h4 className="profile-user__venue">{this.state.email}</h4> */}
                            </div>

                            <MediaQuery minWidth={992}>
                                <div className="profile-user__credits">
                                    <ProfileCreditsMemberships me={me}/>
                                    <StoreCredit me={me}/>
                                </div>
                            </MediaQuery>

                            <div className="profile-user__tools">
                                <div className="profile-user__tools-container">
                                    {/* <LocationsFilter /> */}
                                    <a className='this-logOut' onClick={this.props.handleClickLogout}>
                                        <IconLogOut/>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <MediaQuery maxWidth={991}>
                    <ProfileCreditsMemberships me={me}/>
                    <StoreCredit me={me}/>
                </MediaQuery>

                <div className={'profile-tabs'}>
                    <div className="container">

                        <div id={'ProfileTabs'} className={profileClass + '__tab-content'}>
                            <ul role="tablist" className={tabsClass + ' nav nav-tabs'}>
                                <li role={'presentation'}
                                    className={tabsClass + '__items ' + (screen === 'classes' ? 'active' : '')}>
                                    <div id="classes" onClick={this.handleChangeScreen}
                                         className={tabsClass + '__link'}>{StringStore.get('PROFILE_MY_CLASSES', [window.GFtheme.ClassName])}</div>
                                </li>
                                <li role={'presentation'}
                                    className={tabsClass + '__items ' + (screen === 'profile' ? 'active' : '')}>
                                    <div id="profile" onClick={this.handleChangeScreen}
                                         className={tabsClass + '__link'}>{StringStore.get('PROFILE')}</div>
                                </li>
                                <li role={'presentation'}
                                    className={tabsClass + '__items ' + (screen === 'password' ? 'active' : '')}>
                                    <div id="password" onClick={this.handleChangeScreen}
                                         className={tabsClass + '__link'}>{StringStore.get('CHANGEPASSWORD')}</div>
                                </li>
                                <li role={'presentation'}
                                    className={tabsClass + '__items ' + (screen === 'totals_page' ? 'active' : '')}>
                                    <div id="totals_page" onClick={this.handleChangeScreen}
                                         className={tabsClass + '__link'}>{StringStore.get('PROFILETOTALS')}</div>
                                </li>
                            </ul>

                            <div className={'tab-content'}>
                                <div id="ProfileTabs-pane-1"
                                     className={'fade tab-pane ' + (screen === 'classes' ? 'active in' : '')}>
                                    {brands.length > 1 ?
                                        <div className={filterClass + '__item is-location-filter'}
                                             style={{marginRight: '1rem'}}>
                                            {/* <label htmlFor={'calendar-filter-location'} className={formClass + '__label'}>{StringStore.get('LOCATION')}: </label> */}
                                            <select
                                                className={formClass + '__select'}
                                                id={'calendar-filter-brand'}
                                                data-name="filter_brand"
                                                data-origin="brands"
                                                onChange={this.selectFilter.bind(this)}
                                            >
                                                <option value={''}>Marcas</option>
                                                {brands.map(function (brand, index) {
                                                    return (
                                                        <option value={brand.id}
                                                                key={`${filter_name}-location--option-${index}`}>{brand.name}</option>
                                                    );
                                                })}
                                            </select>
                                            <div className={filterClass + '__item-icon'}>
                                                <IconSelectDownArrow/>
                                            </div>
                                        </div>

                                        : null
                                    }
                                    {locations.length > 1 ?
                                        <div className={filterClass + '__item  is-brand-filter'}>
                                            {/* <label htmlFor={'calendar-filter-location'} className={formClass + '__label'}>{StringStore.get('LOCATION}: </label> */}
                                            <select
                                                className={formClass + '__select'}
                                                id={'calendar-filter-location'}
                                                data-name="filter_location"
                                                data-origin="locations"
                                                onChange={this.selectFilter.bind(this)}
                                            >
                                                <option value={''}>Ubicaciones</option>
                                                {locations.map(function (location, index) {
                                                    return (
                                                        <option value={location.id}
                                                                key={`${filter_name}-location--option-${index}`}>{location.name}</option>
                                                    );
                                                })}
                                            </select>
                                            <div className={filterClass + '__item-icon'}>
                                                <IconSelectDownArrow/>
                                            </div>
                                        </div>

                                        : null
                                    }

                                    <div className={profileClass + '__tab-section'}>
                                        <h4 className={'this-title'}>{StringStore.get('PROFILE_NEXT_CLASSES', [window.GFtheme.ClassName])}</h4>
                                        <FutureClasses
                                            combineWaitlist={combineWaitlist}
                                        />
                                    </div>
                                    <hr></hr>
                                    {this.printFutureWaitlist(profileClass)}
                                    {!combineWaitlist ? (<div>
                                        <hr></hr>
                                    </div>) : null}
                                    <div className={profileClass + '__tab-section'}>
                                        <h4 className={'this-title'}>{StringStore.get('PROFILE_PAST_CLASSES', [window.GFtheme.ClassName])}</h4>
                                        <PastClasses/>
                                    </div>
                                    <hr></hr>
                                    <div className={profileClass + '__tab-section'}>
                                        <h4 className={'this-title'}>{StringStore.get('PROFILE_PURCHASE_HISTORY')}</h4>
                                        <PurchasesList/>
                                    </div>
                                </div>

                                <div id="ProfileTabs-pane-2"
                                     className={'fade tab-pane ' + (screen === 'profile' ? 'active in' : '')}>
                                    <div className={profileClass + '__tab-content'}>
                                        <form className={profileClass + '__form is-UserConf'}
                                              onSubmit={this.handleSubmit.bind(this)}>
                                            <UserInfo info={this.state} updateState={this.updateState.bind(this)}
                                                      handleChangeField={this.handleChangeField.bind(this)}/>
                                            <hr className={formClass + '__divider'}></hr>
                                            <AddressInfo info={this.state} updateState={this.updateState.bind(this)}
                                                         getStatesListByCountry={this.getStatesListByCountry.bind(this)}
                                                         handleChangeField={this.handleChangeField.bind(this)}/>
                                            <hr className={formClass + '__divider'}></hr>
                                            <ContactInfo info={this.state} updateState={this.updateState.bind(this)}
                                                         handleChangeField={this.handleChangeField.bind(this)}/>

                                            <div className={profileClass + '__section is-save'}>
                                                <button disabled={!this.state.formValid} type="submit"
                                                        className={buttonClass + ' ' + buttonClass + "--submit is-primary"}>
                                                    {StringStore.get('BUTTON_SAVE')}
                                                </button>

                                                <div className={formClass + '__notifications'}>
                                                    <div className="text-danger">
                                                        <FormErrors formErrors={this.state.formErrors}/>
                                                        {this.state.serverError !== '' &&
                                                            <small>{this.state.serverError}</small>}
                                                    </div>
                                                    <div className="text-success">
                                                        {this.state.saved &&
                                                            <small>{StringStore.get('SAVE_ME_SUCCESS')}</small>}
                                                    </div>
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                <div id="ProfileTabs-pane-3"
                                     className={'fade tab-pane ' + (screen === 'password' ? 'active in' : '')}>
                                    <div className={profileClass + '__tab-content'}>
                                        <form className={profileClass + '__form is-ChangePassword'}
                                              onSubmit={this.handleSubmit.bind(this)}>
                                            <ChangePassword info={this.state}
                                                            handleChangePassword={this.handleChangePassword.bind(this)}
                                                            handleChangeConfirmationPassword={this.handleChangeConfirmationPassword.bind(this)}/>
                                            <div className={profileClass + '__section is-save'}>
                                                <button
                                                    disabled={!this.state.formValid}
                                                    type="submit"
                                                    className={buttonClass + ' ' + buttonClass + "--submit is-primary"}
                                                >
                                                    {StringStore.get('BUTTON_SAVE')}
                                                </button>

                                                <div className={formClass + '__notifications'}>
                                                    <div className="text-danger">
                                                        <FormErrors formErrors={this.state.formErrors}/>
                                                        {this.state.serverError !== '' &&
                                                            <small>{this.state.serverError}</small>}
                                                    </div>
                                                    <div className="text-success">
                                                        {this.state.saved &&
                                                            <small>{StringStore.get('SAVE_ME_SUCCESS')}</small>}
                                                    </div>
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                <div id="ProfileTabs-pane-4"
                                     className={'fade tab-pane ' + (screen === 'totals_page' ? 'active in' : '')}>
                                    <div className={profileClass + '__tab-content'}>
                                        {totals_page !== null ?
                                            (
                                                <div className="userTotals__row">
                                                    <div className="userTotals__row userTotals__grid__horizontal">
                                                        <div className="userTotals__grid_cell">
                                                            <div className="userTotals__large">
                                                                {totals_page.hasOwnProperty('reservations_without_cancelled_count') ? totals_page.reservations_without_cancelled_count : 0}
                                                            </div>
                                                            <div
                                                                className="userTotals__subtitle userTotals__total_reserved">
                                                                {StringStore.get('RESERVED_CLASSES')}
                                                            </div>
                                                        </div>
                                                        <div className="userTotals__grid_cell">
                                                            <div className="userTotals__large">
                                                                {totals_page.hasOwnProperty('attended_count') ? totals_page.attended_count : 0}
                                                            </div>
                                                            <div
                                                                className="userTotals__subtitle userTotals__total_attended">
                                                                {StringStore.get('ATTENDED_CLASSES')}
                                                            </div>
                                                        </div>
                                                        <div className="userTotals__grid_cell">
                                                            <div className="userTotals__large">
                                                                {totals_page.hasOwnProperty('no_show_count') ? totals_page.no_show_count : 0}
                                                            </div>
                                                            <div
                                                                className="userTotals__subtitle userTotals__total_no_show">
                                                                {StringStore.get('NO_SHOW_CLASSES')}
                                                            </div>
                                                        </div>
                                                        <div className="userTotals__grid_cell">
                                                            <div className="userTotals__large">
                                                                {totals_page.hasOwnProperty('reservations_cancelled_count') ? totals_page.reservations_cancelled_count : 0}
                                                            </div>
                                                            <div
                                                                className="userTotals__subtitle userTotals__total_cancelled">
                                                                {StringStore.get('CANCELLED_CLASSES')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="userTotals__row userTotals__grid__horizontal">
                                                        <div className="userTotals__grid_cell">
                                                            <div className="userTotals__large">
                                                                {totals_page.hasOwnProperty('time_sum') ? totals_page.time_sum : 0}
                                                            </div>
                                                            <div
                                                                className="userTotals__subtitle userTotals__total_minutes">
                                                                {StringStore.get('TIME_ASSISTED')}
                                                            </div>
                                                        </div>
                                                        <div className="userTotals__grid_cell">
                                                            <div className="userTotals__large_list">
                                                                {totals_page.hasOwnProperty('favorite_staff') ? totals_page.favorite_staff : ''}
                                                            </div>
                                                            <div
                                                                className="userTotals__subtitle userTotals__favorite_staff">
                                                                {StringStore.get('FAVORITE_STAFF')}
                                                            </div>
                                                        </div>
                                                        <div className="userTotals__grid_cell">
                                                            <div className="userTotals__large_list">
                                                                {totals_page.hasOwnProperty('favorite_time') ? totals_page.favorite_time : ''}
                                                            </div>
                                                            <div
                                                                className="userTotals__subtitle userTotals__favorite_time">
                                                                {StringStore.get('FAVORITE_TIME')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) :
                                            (<Loading/>)
                                        }
                                    </div>
                                </div>
                            </div>

                            {/* <Tab className={tabsClass + '-container is-payment'} eventKey={4} title={StringStore.get('PAYMENT')}>
                              <CustomScroll heightRelativeToParent="100%">
                                 <div className={profileClass + '__tab-section'}>
                                       <PaymentMethods />
                                 </div>
                              </CustomScroll>
                              <div className={paymentClass + "__notification " + (paymentNotification ? 'is-active' : '')}>
                                 <div className={paymentClass + "__notification-container"}>
                                       <p>{!paymentNotification ? 'Error: No encuentré el mensaje' : paymentNotification.message}</p>
                                       <div className={paymentClass + "__controls"}>
                                          <button className={buttonClass + "__controls is-success"} onClick={this.deleteCard.bind(this)}>
                                             <CheckIcon />
                                          </button>
                                          <button className={buttonClass + "__controls is-close"} onClick={this.closeNotification.bind(this)}>
                                             <CloseIcon />
                                          </button>
                                       </div>
                                 </div>
                              </div>
                           </Tab> */}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default ProfileUserInfo;
