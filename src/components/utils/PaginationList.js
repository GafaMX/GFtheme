'use strict';

import React from "react";
import IconLeftArrow from "../utils/Icons/IconLeftArrow"
import IconRightArrow from "../utils/Icons/IconRightArrow"

import '../../styles/newlook/elements/GFSDK-e-pagination.scss';

class PaginationList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isActive: false,
        };
        this.handleClick = this.handleClick.bind(this);
    }


    handleClick(id, event) {

        let options = this.props.extraOptions ? this.props.extraOptions : {};
        options.per_page = this.props.perpage;

        let currentComponent = this;
        if (typeof id === 'number') {
            options.page = id;
            this.props.getListData(options, function (result) {
                event.preventDefault();
                currentComponent.props.updatePaginationData(result);
            });
        }
        if (id === 'past') {
            options.page = this.props.page - 1;
            this.props.getListData(options, function (result) {
                event.preventDefault();
                currentComponent.props.updatePaginationData(result);
            });
        }
        if (id === 'next') {
            options.page = this.props.page + 1;
            this.props.getListData(options, function (result) {
                event.preventDefault();
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

        let preE = 'GFSDK-e';
        let paginationClass = preE + '-pagination';

        if (this.props.allpages < 2) {
            return false;
        } else {
            let pageElements = [];
            let totalpages = this.props.allpages;
            for (let i = 0; i < totalpages; i++) {
                pageElements.push(
                    <div key={'page-' + i} className={[paginationClass + '__bullets']}>
                        <button id={i + 1} className={'btn ' + this.getActive(i + 1)}
                                onClick={(e) => this.handleClick(i + 1, e)}>
                            {/* <a>{i + 1}</a> */}
                        </button>
                    </div>)
            }

            return (
                <div className={paginationClass}>
                    <div className={paginationClass + '__container'}>
                        <div className={paginationClass + '__past'}>
                            <button className={this.firstPage(this.props.page)}
                                    id={['past']}
                                    onClick={(e) => this.handleClick('past', e)}>
                                        <IconLeftArrow />
                                    </button>
                        </div>
                        {pageElements}
                        <div className={paginationClass + '__next'}>
                            <button className={this.lastPage(this.props.page)}
                                    id={['next']}
                                    onClick={(e) => this.handleClick('next', e)}>
                                        <IconRightArrow />
                                    </button>
                        </div>
                    </div>
                </div>
            );
        }

    }
}

export default PaginationList;