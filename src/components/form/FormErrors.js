import React from 'react';
import Strings from "../utils/Strings/Strings_ES";
import StringStore from "../utils/Strings/StringStore";

export const FormErrors = ({formErrors}) =>
    <div className='formErrors'>
        {Object.keys(formErrors).map((fieldName, i) => {
            if (formErrors[fieldName].length > 0) {
                return (
                    <small key={i}>{StringStore.get('THE_FIELD')} {StringStore.get('TO_VALIDATION.fieldName')} {formErrors[fieldName]}</small>
                )
            } else {
                return '';
            }
        })}
    </div>;