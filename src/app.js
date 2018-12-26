import GafaThemeSDK from "./components/GafaThemeSDK";
import style from "./css/basic-theme.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import GafaFitSDKWrapper from "./components/utils/GafaFitSDKWrapper";

GafaFitSDKWrapper.initValues();
GafaThemeSDK.renderLogin('#test');