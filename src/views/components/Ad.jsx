import React from 'react';
import { models } from 'snoode';

import constants from '../../constants';
import BaseComponent from './BaseComponent';
import Listing from './Listing';
import Post from './listings/Post';

import makeRequest from '../../lib/makeRequest';
import {
  aspectRatioClass,
} from './listings/mediaUtils';

const T = React.PropTypes;

class Ad extends BaseComponent {
  static propTypes = {
    listingRedesign: T.bool,
    app: T.object.isRequired,
    config: T.object.isRequired,
    apiOptions: T.object.isRequired,
    ctx: T.object.isRequired,
    loid: T.string,
    compact: T.bool.isRequired,
    site: T.string.isRequired,
    subredditTitle: T.string,
    afterLoad: T.func.isRequired,
  };

  static defaultProps = {
    listingRedesign: false,
  };

  constructor (props) {
    super(props);

    this.state = {
      loaded: false,
      unavailable: false,
    };

    this._checkImpression = this._checkImpression.bind(this);

    this._removeListeners = this._removeListeners.bind(this);
  }

  checkPos() {
    if (this.state.unavailable) {
      return true;
    }

    const listing = this.refs.listing;

    if (!listing) {
      return true;
    }

    if (this.props.listingRedesign) {
      return listing.loadContentIfNeeded(...arguments);
    }

    return listing.checkPos(...arguments);
  }

  getAd() {
    const site = this.props.site;
    const specificAd = this.props.ctx.query.ad;

    if (specificAd) {
      return new Promise(function (resolve, reject) {
        const options = Object.assign({}, this.props.apiOptions, { id: specificAd });

        this.props.app.api.links.get(options)
          .then((link) => {
            resolve(new models.Link(link).toJSON());
          }, (err) => {
            reject(err);
          });
      }.bind(this));
    }

    const app = this.props.app;
    const token = this.props.ctx.token;
    const loggedIn = !!token;
    const origin = (loggedIn ? app.config.authAPIOrigin : app.config.nonAuthAPIOrigin);
    const headers = {};
    const postData = {
      site,
      platform: 'mobile_web',
      raw_json: '1',
    };

    // If user is not logged in, send the loid in the promo request
    if (loggedIn) {
      headers.authorization = `Bearer ${token}`;
    } else {
      postData.loid = this.props.loid;
    }

    return makeRequest
      .post(origin + this.props.config.adsPath)
      .set(headers)
      .type('form')
      .send(postData)
      .timeout(constants.DEFAULT_API_TIMEOUT)
      .then(function(res) {
        if (!res || !res.body || res.status !== 200) {
          throw res;
        }
        const link = res.body.data;
        link.url = link.href_url;
        return new models.Link(link).toJSON();
      });
  }

  componentDidMount() {
    this.getAd().then((ad) => {
      throw new Exception('test')
      return this.setState({
        loaded: true,
        ad: new models.Link(ad).toJSON(),
      });
    }, () => {
      this.setState({
        unavailable: true,
      });
    });

    this.props.app.on(constants.SCROLL, this._checkImpression);
    this.props.app.on(constants.RESIZE, this._checkImpression);

    this._hasListeners = true;
    this._checkImpression();
  }

  componentDidUpdate (prevProps, prevState) {
    if (!prevState.loaded && this.state.loaded) {
      this.props.afterLoad();
      this._checkImpression();
    }

    if (!prevState.unavailable && this.state.unavailable) {
      this.getFacebookAd();
    }
  }

  componentWillUnmount() {
    this._removeListeners();
  }

  _removeListeners() {
    if (this._hasListeners) {
      this.props.app.off(constants.SCROLL, this._checkImpression);
      this.props.app.off(constants.RESIZE, this._checkImpression);
      this._hasListeners = false;
    }
  }

  _checkImpression() {
    const adObject = this.state.ad;

    if (adObject) {
      const node = this.domNode;
      const winHeight = window.innerHeight;
      const rect = node.getBoundingClientRect();
      const top = rect.top;
      const height = rect.height;
      const bottom = top + rect.height;
      const middle = (top + bottom) / 2;
      const middleIsAboveBottom = middle < winHeight;
      const middleIsBelowTop = bottom > constants.TOP_NAV_HEIGHT + height / 2;

      if (middleIsAboveBottom && middleIsBelowTop) {
        const srcs=['imp_pixel', 'adserver_imp_pixel'];

        for (let i = 0, iLen = srcs.length; i < iLen; i++) {
          const pixel = new Image();
          pixel.src = adObject[srcs[i]];
        }

        this._removeListeners();
      }
    }
  }

  getFacebookAd() {
    const facebookAudienceAppId = this.props.config.facebookAudienceAppId;

    window.fbAsyncInit = function() {
      FB.Event.subscribe(
        'ad.loaded',
        function(placementId) {
          console.log('Audience Network ad loaded');
          var root = document.getElementById('ad_root');
          var media = root.getElementsByClassName('thirdPartyMediaClass')[0];

          if (media && media.childNodes[0].tagName === 'IMG') {
            media.style.height = 'auto';
          }

          root.style.display = 'block';
        }
      );
      FB.Event.subscribe(
        'ad.error',
        function(errorCode, errorMessage, placementId) {
          console.log('Audience Network error (' + errorCode + ') ' + errorMessage);
        }
      );
    };
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = `//connect.facebook.net/en_US/sdk/xfbml.ad.js#xfbml=1&version=v2.5&appId=${facebookAudienceAppId}`;
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  }

  renderFacebookAd() {
    const facebookAudiencePlacementId = this.props.config.facebookAudiencePlacementId;

    const adCode = `
      <style>
         #ad_root {
            display: none;
            position: relative;
            width: 100%;
            background: #fff;
          }

          .thirdPartyLinkClass:hover {
            text-decoration: none;
          }

          .thirdPartyMediaClass {
            height: 157px;
          }

          .thirdPartyMediaClass img {
            height: auto !important;
            width: 100% !important;
            object-fit: contain !important;
          }

          .thirdPartyTitleClass {
            font-weight: 600;
            font-size: 16px;
            margin: 8px 0 4px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .thirdPartyBodyClass {
            display: -webkit-box;
            height: 32px;
            -webkit-line-clamp: 2;
            overflow: hidden;
          }

          .thirdPartyCallToActionClass {
            color: #326891;
            font-family: sans-serif;
            font-weight: 600;
          }
        </style>
      <fb:ad
        placementid="${facebookAudiencePlacementId}"
        format="native"
        nativeadid="ad_root"
        testmode="true">
      </fb:ad>
      <article id="ad_root" class="Post size-default">
        <a class="fbAdLink thirdPartyLinkClass">
          <div class="Post__header-wrapper">
            <header class="PostHeader">
              <div class="PostHeader__post-descriptor-line">
                <div class="PostHeader__post-descriptor-line-overflow">
                  <span class="PostHeader__sponsored-flair">SPONSORED</span>
                </div>
              </div>
              <div class="PostHeader__post-title-line fbAdTitle"></div>
            </header>
          </div>
          <div class="PostContent size-default">
            <div class="PostContent__media-wrapper">
              <div class="fbAdMedia thirdPartyMediaClass"></div>
              <div class="PostContent__link-bar">
                <div class="PostContent__link-bar-text fbAdCallToAction"></div>
                <span class="PostContent__link-bar-icon icon-linkout blue"></span>
              </div>
            </div>
          </div>
          <div class="PostFooter">
            <!--
            <div class="PostFooter__vote-and-tools-wrapper">
              <div class="PostFooter__dropdown-button PostFooter__hit-area icon-seashells"></div>
              <span class="PostFooter__vertical-divider"></span>
              <div class="PostFooter__hit-area">
                <span class="PostFooter__vote-text">
                  ●
                </span>
                <span class="PostFooter__vote-arrow-wrapper">
                  <span class="icon-upvote blue"></span>
                </span>
                <span class="PostFooter__vote-arrow-wrapper">
                  <span class="icon-downvote blue"></span>
                </span>
              </div>
            </div>
            -->
          </div>
        </a>
      </article>
    `;
    
    return (
      <div dangerouslySetInnerHTML={ { __html: adCode } } />
    );
  }

  render() {
    if (this.state.unavailable) {
      return this.renderFacebookAd();
    }

    if (!this.state.loaded) {
      return null;
    }

    const props = this.props;
    const listing = Object.assign({}, this.state.ad, { compact: props.compact });

    if (props.listingRedesign) {
      return (
        <Post
          ref='listing'
          {...props}
          hideDomain={ true }
          hideSubredditLabel={ true }
          hidewhen={ true }
          post={ listing }
        />
      );
    }

    return (
      <Listing
        ref='listing'
        {...props}
        hideDomain={ true }
        hideSubredditLabel={ true }
        hideWhen={ true }
        listing={ listing }
      />
    );
  }
}

export default Ad;
