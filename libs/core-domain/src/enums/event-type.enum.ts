export enum EventType {
    // Usuario
    UserSignup = 'user_signup',
    UserLogin = 'user_login',
    UserLogout = 'user_logout',
    ProfileUpdate = 'profile_update',
    // Social
    PostCreated = 'post_created',
    PostLiked = 'post_liked',
    PostShared = 'post_shared',
    CommentAdded = 'comment_added',
    // Monetización
    PaymentMade = 'payment_made',
    SubscriptionStarted = 'subscription_started',
    DonationMade = 'donation_made',
    // Feed
    FeedViewed = 'feed_viewed',
    PostImpression = 'post_impression',
    // Personalizados
    Custom = 'custom_event',
  }
  