import _ from 'lodash';
import React from 'react';
import superagent from 'superagent';
import { models } from 'snoode';

import constants from '../../constants';
import frames from '../../lib/frames';

import Listing from './Listing';


const TIMEOUT = 10 * 1000;

class Ad extends React.Component {
  constructor (props) {
    super(props);

    this.id = _.uniqueId('dfp-sponsored-headline-');
    this.state = {
      loaded: false,
      unavailable: false,
    };

    this._scroll = _.throttle(this._scroll.bind(this), 100);
  }

  getCreative () {
    var adId = this.id;
    var props = this.props;

    frames.listen('dfp');

    return new Promise(function(resolve, reject) {
      frames.receiveMessageOnce('init.dfp', function(e) {
        frames.stopListening('dfp');
        resolve(e.detail);
      });

      googletag.cmd.push(function() {
        googletag
          .defineOutOfPageSlot(props.app.config.adsSlot, adId)
          .addService(googletag.pubads())
          .setTargeting('subreddit', props.srnames);

        googletag.pubads().enableSingleRequest();
        googletag.enableServices();
      });

      googletag.cmd.push(function() {
        googletag.display(adId);
      });

      setTimeout(() => {
        reject('dfp ad creative timeout');
      }, TIMEOUT);
    });
  }

  getLink (id) {
    var props = this.props;
    var url = (props.token ?
      props.app.config.authAPIOrigin : props.app.config.nonAuthAPIOrigin) +
        '/api/dfp/link.json';
    var headers = {};

    if (props.token) {
      headers.authorization = 'bearer ' + props.token;
    };

    return new Promise((resolve, reject) => {
      superagent
        .post(url)
        .set(headers)
        .type('form')
        .send({
          dfp_creative_id: id,
          raw_json: 1,
        })
        .end(function(err, res) {
          if (err || !res.ok) {
            reject(err);
            return;
          }

          // Ad is missing attributes
          if (res.body.json && res.body.json.errors) {
            reject(res.body.json);
            return;
          }

          resolve(res.body.data);
        });
    });
  }

  checkPos () {
    if (this.state.unavailable) {
      return true;
    }

    var listing = this.refs.listing;

    if (!listing) {
      return false;
    }

    return listing.checkPos.apply(listing, arguments);
  }

  resize () {
    if (this.state.unavailable) {
      return;
    }

    var listing = this.refs.listing;

    if (!listing) {
      return;
    }

    listing.resize.apply(listing, arguments);
  }

  componentDidMount () {
    this.getCreative().then(creative => {
      this.getLink(creative.dfp_creative_id).then(link => {
        var url = link.url;

        link.url = creative.dfp_click_tracker + encodeURIComponent(link.href_url);

        return this.setState({
          loaded: true,
          ad: new models.Link(link).toJSON(),
          impressionTrackers: _.compact([
            link.imp_pixel,
            link.adserver_imp_pixel,
            link.third_party_tracker,
            link.third_party_tracker_2,
            creative.dfp_impression_tracker + encodeURIComponent(url),
          ]),
        });
      });
    }, () => {
      this.setState({
        unavailable: true,
      });
    });
  }

  componentDidUpdate (prevProps, prevState) {
    if (!prevState.loaded && this.state.loaded) {
      this.props.afterLoad();
      this.props.app.on(constants.SCROLL, this._scroll);
      this.props.app.on(constants.RESIZE, this._scroll);

      this._hasListeners = true;
      this._scroll();
    }
  }

  componentWillUnmount() {
    frames.stopListening();
    this._removeListeners();
  }

  _removeListeners() {
    if (this._hasListeners) {
      this.props.app.off(constants.SCROLL, this._scroll);
      this.props.app.off(constants.RESIZE, this._scroll);
      this._hasListeners = false;
    }
  }

  _scroll() {
    if (this.state.loaded || this.state.unavailable) {
      var trackers = this.state.impressionTrackers;

      if (!trackers.length) {
        return this._removeListeners();
      }

      var node = React.findDOMNode(this);
      var winHeight = window.innerHeight;
      var rect = node.getBoundingClientRect();
      var top = rect.top;
      var height = rect.height;
      var bottom = top + rect.height;
      var middle = (top + bottom) / 2;
      var middleIsAboveBottom = middle < winHeight;
      var middleIsBelowTop = bottom > constants.TOP_NAV_HEIGHT + height / 2;

      if (middleIsAboveBottom && middleIsBelowTop) {
        for (var i = 0; i < trackers.length; i++) {
          var pixel = new Image();
          pixel.src = trackers[i];
        }

        this._removeListeners();
      }
    }
  }

  render () {
    if (this.state.unavailable) {
      return null;
    }

    if (!this.state.loaded) {
      return (<div id={ this.id }></div>);
    }

    var props = this.props;
    var listing = _.extend({}, this.state.ad, { compact: props.compact });

    return (
      <Listing
        ref='listing'
        {...props}
        listing={listing}
        hideSubredditLabel={true}
        hideDomain={true}
        hideWhen={true} />
    );
  }
};

Ad.propTypes = {
  afterLoad: React.PropTypes.func.isRequired,
  compact: React.PropTypes.bool.isRequired,
  srnames: React.PropTypes.array.isRequired,
};

export default Ad;
