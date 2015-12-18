import React from 'react';
import BaseComponent from '../components/BaseComponent';
import LiveReload from '../components/LiveReload';

function DefaultLayout  (props) {
  const assetPath = props.config.assetPath;
  const manifest = props.config.manifest;

  let baseCSS = assetPath + '/css/';
  let clientJS = assetPath + '/js/';

  let liveReload;
  if (props.config.liveReload) {
    liveReload = (<LiveReload />);
  }

  if (props.config.minifyAssets) {
    baseCSS += manifest['base.css'];
    clientJS += manifest['client.min.js'];
  } else {
    baseCSS += 'base.css';
    clientJS += 'client.js';
  }

  let canonical;

  if (props.config.url) {
    canonical = (
      <link rel='canonical' href={ `${props.config.reddit}${props.ctx.url}` } />
    );
  }

  let metaDescription;

  if (props.metaDescription) {
    metaDescription = (
      <meta name='description' content={ props.metaDescription } />
    );
  }

  let gaTracking;

  if (props.config.googleAnalyticsId) {
    let googleAnalyticsId = props.config.googleAnalyticsId;

    let trackingCode = `
      <script>
      if (!window.DO_NOT_TRACK) {
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
        (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

        ga('create', '${googleAnalyticsId}', 'auto', {'sampleRate': 50});
        ga('send', 'pageview');
      }
      </script>
    `;

    gaTracking = (
      <div dangerouslySetInnerHTML={{ __html: trackingCode }} />
    );
  }

  let gtmTracking;

  if (props.config.googleTagManagerId && props.config.mediaDomain) {
    const gtmCode = `
      <script>
        if (!window.DO_NOT_TRACK) {
          var frame = document.createElement('iframe');
          frame.style.display = 'none';
          frame.referrer = 'no-referrer';
          frame.id = 'gtm-jail';
          frame.src = '//${props.config.mediaDomain}/gtm/jail?id=${props.config.googleTagManagerId}';
          document.body.appendChild(frame);
        }
      </script>
    `;

    gtmTracking = (
      <div dangerouslySetInnerHTML={{ __html: gtmCode }} />
    );
  }

  return (
    <html>
      <head>
        <title>{ props.title }</title>
        <link href={ baseCSS } rel='stylesheet' />
        { canonical }

        <meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' />
        <meta name='theme-color' content='#336699' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta id='csrf-token-meta-tag' name='csrf-token' content={ props.ctx.csrf } />
        { metaDescription }

        <link href={ `${assetPath}/favicon/64x64.png` } rel="icon shortcut" sizes="64x64" />
        <link href={ `${assetPath}/favicon/128x128.png` } rel="icon shortcut" sizes="128x128" />
        <link href={ `${assetPath}/favicon/192x192.png` } rel="icon shortcut" sizes="192x192" />
        <link href={ `${assetPath}/favicon/76x76.png` } rel="apple-touch-icon" sizes="76x76" />
        <link href={ `${assetPath}/favicon/120x120.png` } rel="apple-touch-icon" sizes="120x120" />
        <link href={ `${assetPath}/favicon/152x152.png` } rel="apple-touch-icon" sizes="152x152" />
        <link href={ `${assetPath}/favicon/180x180.png` } rel="apple-touch-icon" sizes="180x180" />
      </head>
      <body className='navbar-offcanvas-target'>
        <div id='app-container'>
          !!CONTENT!!
        </div>

        <script src={ clientJS } async='true'></script>
        { liveReload }
        { gtmTracking }
        { gaTracking }
      </body>
    </html>
  );
}

//TODO: someone more familiar with this component could eventually fill this out better
DefaultLayout.propTypes = {
  metaDescription: React.PropTypes.string,
  title: React.PropTypes.string.isRequired,
};

export default DefaultLayout;
