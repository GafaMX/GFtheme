'use strict';

import React from "react";
import './styles/PaginationProwess.scss'

export default class PaginationProwess extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isActive: false,
        };
        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(id, event) {

        let {currentBrand} = this.props;
        let brand = currentBrand.slug;
        let options = this.props.extraOptions ? this.props.extraOptions : {};
        options.per_page = this.props.perpage;

        let currentComponent = this;
        // if (typeof id === 'number') {
        //     options.page = id;
        //     this.props.getListData(brand, options, function (result) {
        //         event.persist()
        //         currentComponent.props.updatePaginationData(result);
        //     });
        // }
        if (id === 'past') {
            options.page = this.props.page - 1;
            this.props.getListData(brand, options, function (result) {
                event.persist()
                currentComponent.props.updatePaginationData(result);
            });
        }
        
        if (id === 'next') {
            options.page = this.props.page + 1;
            this.props.getListData(brand, options, function (result) {
                event.persist()
                currentComponent.props.updatePaginationData(result);
            });
        }
    }

    getActive(id) {
        return id === this.props.page ? 'active-page' : '';
    }

    firstPage(actual) {
        return actual === 1 ? 'hide-button' : '';
    }

    lastPage(actual) {
        return actual === this.props.allpages ? 'hide-button' : '';
    }

    render() {
        if (this.props.allpages < 2) {
            return false;
        } else {
            let pageElements = [];
            let totalpages = this.props.allpages;
            for (let i = 0; i < totalpages; i++) {
                pageElements.push(
                    <div key={'page-' + i} className={["btn-group mr-2"]}>
                        <button id={i + 1} className={'btn ' + this.getActive(i + 1)}
                                onClick={(e) => this.handleClick(i + 1, e)}>
                            <a>{i + 1}</a></button>
                    </div>)
            }

            return (
                <div>
                {/* <div className={"qodef-grid-1300"}> */}
                    <div className={"GFSDK-pagination__container"}>
                        <div className={"qodef-ps-navigation"}>

                            <div className={"qodef-ps-prev"}>
                                <a className={'qodef-btn qodef-btn-solid ' + this.firstPage(this.props.page)} id={['past']} onClick={(e) => this.handleClick('past', e)}>
                                    <span className={"qodef-ps-nav-mark qodef-icon-ion-icon ion-arrow-left-c"}></span>
                                </a>
                            </div>

                            {/* {pageElements} */}

                            <div className={"qodef-ps-next"}>
                                <a className={'qodef-btn qodef-btn-solid ' + this.lastPage(this.props.page)} id={['next']} onClick={(e) => this.handleClick('next', e)}>
                                    <span className={"qodef-ps-nav-mark qodef-icon-ion-icon ion-arrow-right-c"}></span>
                                </a>
                            </div>

                        </div>
                    </div>
                </div>
            );
        }

    }
}