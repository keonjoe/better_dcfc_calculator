import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = "EV Charging Calculator - Compare DC Fast Charging Costs & Times",
  description = "Free EV charging calculator to estimate DC fast charging (DCFC) costs, time, and efficiency. Compare charging speeds, battery curves, and lifetime costs for electric vehicles.",
  keywords = "EV charging calculator, DCFC calculator, electric vehicle charging cost, fast charging time, EV battery charging curve, Tesla charging calculator, EV cost calculator, electric car charging",
  url = "https://better-dcfc-calculator.vercel.app/",
  image = "https://better-dcfc-calculator.vercel.app/og-image.png",
  type = "website"
}) => {
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
    </Helmet>
  );
};

export default SEO;
