# Kyuzo Brazilian Jiu Jitsu - Admin Manual

## Table of Contents
1. [Introduction](#introduction)
2. [Admin Panel Access](#admin-panel-access)
3. [Dashboard Overview](#dashboard-overview)
4. [User Management](#user-management)
5. [Class and Booking Management](#class-and-booking-management)
6. [Membership and Billing Management](#membership-and-billing-management)
7. [Website Content Management](#website-content-management)
8. [Media Management](#media-management)
9. [System Configuration](#system-configuration)
10. [Reports and Analytics](#reports-and-analytics)
11. [Troubleshooting](#troubleshooting)

## Introduction

The Kyuzo Admin Panel is a comprehensive content management system built on Payload CMS that allows administrators to manage all aspects of the Brazilian Jiu Jitsu academy. This system provides tools for managing members, classes, bookings, memberships, payments, and website content.

### Admin Panel Features
- **User Management**: Create, edit, and manage member accounts
- **Class Scheduling**: Set up and manage class schedules and options
- **Booking Management**: Monitor and manage class bookings
- **Membership Plans**: Create and manage subscription plans
- **Payment Processing**: Handle Stripe payments and transactions
- **Content Management**: Update website pages and blog posts
- **Media Library**: Manage images and documents
- **Role-Based Access**: Control permissions for different admin levels

### Admin Groups
The admin panel is organized into logical groups:
- **Bookings**: Class options, lessons, and bookings
- **Billing**: Subscriptions, plans, and transactions
- **Products**: Drop-ins and payment methods
- **Website**: Pages, posts, and navigation
- **Blog**: Blog posts and content
- **Users**: Member accounts and roles

## Admin Panel Access

### Initial Setup
1. **First Admin User**: The first user to register automatically receives admin privileges
2. **Admin URL**: Access the admin panel at `/admin` on your domain
3. **Login**: Use your email and password to access the admin panel

### Admin Roles
- **Admin**: Full access to all features and settings
- **Customer**: Standard member access (frontend only)

### Security Best Practices
- Use strong, unique passwords
- Log out when finished
- Don't share admin credentials
- Regularly review user permissions
- Monitor admin activity logs

## Dashboard Overview

### Main Dashboard Features
- **Quick Stats**: Overview of key metrics
- **Recent Activity**: Latest bookings, payments, and user registrations
- **Quick Actions**: Direct links to common tasks
- **System Status**: Current system health and notifications

### Navigation
- **Collections**: Manage different data types (users, classes, etc.)
- **Globals**: Site-wide settings and content
- **Media**: File uploads and management
- **Settings**: System configuration

## User Management

### Managing Users
**Location**: Collections → Users

#### User Information
- **Email**: Primary identifier and login credential
- **Name**: Full name of the member
- **Parent**: For child accounts, link to parent user
- **Roles**: Admin or customer permissions
- **Created Date**: When the account was created

#### Creating New Users
1. Navigate to Collections → Users
2. Click "Create New"
3. Fill in required fields:
   - Email address
   - Full name
   - Password (if creating for them)
4. Set appropriate role (admin/customer)
5. For children, link to parent account
6. Click "Save"

#### Editing Users
1. Find the user in the Users collection
2. Click on their email to edit
3. Update information as needed
4. Save changes

#### User Roles
- **Admin**: Full administrative access
- **Customer**: Standard member access

### Bulk Operations
- **Export Users**: Download user data for analysis
- **Bulk Actions**: Perform actions on multiple users
- **Filtering**: Search and filter users by various criteria

## Class and Booking Management

### Class Options
**Location**: Collections → Class Options

#### Creating Class Options
1. Navigate to Collections → Class Options
2. Click "Create New"
3. Configure the class option:
   - **Name**: Class name (e.g., "Adult BJJ", "Kids BJJ")
   - **Places**: Maximum number of participants
   - **Description**: Class description
   - **Type**: Adult or child class
   - **Payment Methods**: Allowed membership plans

#### Class Types
- **Adult Classes**: For members 16 years and older
- **Children's Classes**: Specialized programs for younger students

#### Payment Method Configuration
- Link class options to appropriate membership plans
- Adult classes can accept adult and family plans
- Children's classes can accept child and family plans

### Lessons
**Location**: Collections → Lessons

#### Creating Lessons
1. Navigate to Collections → Lessons
2. Click "Create New"
3. Configure lesson details:
   - **Date**: When the class takes place
   - **Start Time**: Class start time
   - **End Time**: Class end time
   - **Class Option**: Which type of class
   - **Instructor**: Who's teaching (if applicable)

#### Lesson Management
- **Bulk Creation**: Create multiple lessons at once
- **Recurring Lessons**: Set up regular class schedules
- **Cancellation**: Cancel individual or recurring lessons
- **Capacity Management**: Monitor class attendance

### Bookings
**Location**: Collections → Bookings

#### Viewing Bookings
- **All Bookings**: Complete booking history
- **Filter by Date**: View bookings for specific periods
- **Filter by Class**: View bookings for specific classes
- **Filter by User**: View bookings for specific members

#### Managing Bookings
- **Edit Bookings**: Modify booking details
- **Cancel Bookings**: Cancel individual bookings
- **Bulk Actions**: Perform actions on multiple bookings
- **Export Data**: Download booking reports

#### Booking Information
- **Member**: Who made the booking
- **Lesson**: Which class they booked
- **Status**: Confirmed, cancelled, etc.
- **Payment**: Associated payment information
- **Created Date**: When the booking was made

## Membership and Billing Management

### Plans
**Location**: Collections → Plans

#### Creating Membership Plans
1. Navigate to Collections → Plans
2. Click "Create New"
3. Configure plan details:
   - **Name**: Plan name (e.g., "Monthly Adult", "Family Plan")
   - **Type**: Adult, family, or child
   - **Features**: What's included in the plan
   - **Sessions**: Number of classes included
   - **Interval**: How often (monthly, annually, etc.)
   - **Stripe Product**: Link to Stripe product
   - **Status**: Active or inactive

#### Plan Types
- **Adult Plans**: Individual adult memberships
- **Family Plans**: Cover multiple family members
- **Children's Plans**: Individual child memberships

#### Stripe Integration
- **Product Linking**: Connect plans to Stripe products
- **Price Management**: Handle pricing through Stripe
- **Webhook Management**: Automatic status updates

### Subscriptions
**Location**: Collections → Subscriptions

#### Managing Subscriptions
- **Active Subscriptions**: View current memberships
- **Subscription Status**: Monitor payment status
- **Billing Cycles**: Track renewal dates
- **Payment History**: View past payments

#### Subscription Statuses
- **Active**: Current, paid subscription
- **Past Due**: Payment overdue
- **Canceled**: Cancelled subscription
- **Paused**: Temporarily paused
- **Incomplete**: Payment pending

#### Subscription Actions
- **Pause Subscriptions**: Temporarily suspend memberships
- **Cancel Subscriptions**: End memberships
- **Update Payment Methods**: Change billing information
- **Refund Processing**: Handle payment refunds

### Transactions
**Location**: Collections → Transactions

#### Payment Tracking
- **Transaction History**: Complete payment records
- **Payment Methods**: Cash, card, or other methods
- **Status Tracking**: Pending, completed, failed
- **Amount Management**: Track payment amounts

#### Transaction Management
- **Manual Transactions**: Record cash payments
- **Refund Processing**: Handle payment refunds
- **Payment Reconciliation**: Match payments to bookings
- **Financial Reporting**: Generate payment reports

## Website Content Management

### Pages
**Location**: Collections → Pages

#### Creating Pages
1. Navigate to Collections → Pages
2. Click "Create New"
3. Configure page details:
   - **Title**: Page title
   - **Slug**: URL path (e.g., "about-us")
   - **Layout**: Page content blocks

#### Page Layout Blocks
- **Hero Section**: Main page banner
- **Schedule Block**: Class schedule display
- **Form Block**: Contact or registration forms
- **Content Blocks**: Rich text content

#### Page Management
- **SEO Optimization**: Meta titles and descriptions
- **Publishing**: Draft and published states
- **URL Management**: Custom slugs and routing
- **Content Versioning**: Track content changes

### Blog Posts
**Location**: Collections → Posts

#### Creating Blog Posts
1. Navigate to Collections → Posts
2. Click "Create New"
3. Configure post details:
   - **Title**: Post title
   - **Excerpt**: Short description
   - **Content**: Rich text content
   - **Hero Image**: Featured image
   - **Publish Date**: When to publish
   - **Slug**: URL path

#### Blog Management
- **Content Editor**: Rich text editing with formatting
- **Image Management**: Upload and manage images
- **Categories**: Organize posts by topic
- **SEO Settings**: Meta information for search engines

### Navigation
**Location**: Globals → Navbar

#### Managing Navigation
- **Menu Items**: Add, edit, or remove navigation links
- **External Links**: Link to external websites
- **Internal Links**: Link to pages within the site
- **Logo Management**: Update site logo

#### Footer Management
**Location**: Globals → Footer
- **Footer Content**: Update footer information
- **Contact Details**: Address, phone, email
- **Social Links**: Social media profiles
- **Legal Links**: Privacy policy, terms of service

## Media Management

### Media Library
**Location**: Collections → Media

#### Uploading Media
1. Navigate to Collections → Media
2. Click "Upload Media"
3. Select files to upload
4. Add alt text for accessibility
5. Organize with tags or categories

#### Media Management
- **File Organization**: Categorize and tag media
- **Image Optimization**: Automatic resizing and compression
- **Alt Text**: Accessibility descriptions
- **Usage Tracking**: See where media is used

#### Supported Formats
- **Images**: JPG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX
- **Videos**: MP4, MOV, AVI

## System Configuration

### Environment Settings
- **Database Configuration**: PostgreSQL connection settings
- **Stripe Integration**: API keys and webhook settings
- **Email Configuration**: SMTP settings for notifications
- **File Storage**: Media file storage configuration

### Plugin Configuration
- **Bookings Plugin**: Class and booking settings
- **Memberships Plugin**: Subscription and plan settings
- **Payments Plugin**: Payment processing configuration
- **Auth Plugin**: Authentication and user management
- **Roles Plugin**: Permission and role management

### Security Settings
- **Admin Access**: Control who can access admin panel
- **API Security**: Secure API endpoints
- **Data Backup**: Regular backup procedures
- **Audit Logging**: Track admin actions

## Reports and Analytics

### Booking Reports
- **Attendance Tracking**: Monitor class attendance
- **Popular Classes**: Identify most popular class types
- **Booking Trends**: Analyze booking patterns
- **Capacity Utilization**: Track class capacity usage

### Financial Reports
- **Revenue Tracking**: Monitor membership revenue
- **Payment Analytics**: Analyze payment patterns
- **Subscription Metrics**: Track subscription health
- **Refund Analysis**: Monitor refund patterns

### User Analytics
- **Member Growth**: Track new member registrations
- **Retention Rates**: Monitor member retention
- **Engagement Metrics**: Track member activity
- **Demographics**: Analyze member demographics

### Export Options
- **CSV Export**: Download data for external analysis
- **PDF Reports**: Generate printable reports
- **Scheduled Reports**: Automatic report generation
- **Custom Dashboards**: Create custom analytics views

## Troubleshooting

### Common Admin Issues

#### Can't Access Admin Panel
- **Problem**: Login credentials not working
- **Solution**: Reset password or check email
- **Problem**: Admin role not assigned
- **Solution**: Contact system administrator

#### Class Booking Issues
- **Problem**: Can't create class options
- **Solution**: Check admin permissions
- **Problem**: Bookings not showing
- **Solution**: Verify lesson dates and times
- **Problem**: Payment integration issues
- **Solution**: Check Stripe configuration

#### Payment Problems
- **Problem**: Stripe webhooks not working
- **Solution**: Verify webhook endpoints and keys
- **Problem**: Subscription status not updating
- **Solution**: Check Stripe dashboard for payment status
- **Problem**: Manual payment recording
- **Solution**: Use transaction collection for cash payments

#### Content Management Issues
- **Problem**: Page changes not appearing
- **Solution**: Check publishing status and cache
- **Problem**: Media uploads failing
- **Solution**: Verify file size limits and formats
- **Problem**: Navigation not updating
- **Solution**: Clear cache and check global settings

### System Maintenance

#### Regular Tasks
- **Backup Database**: Daily automated backups
- **Monitor Logs**: Check for errors and issues
- **Update Content**: Keep website content current
- **Review Analytics**: Monitor system performance

#### Performance Optimization
- **Image Optimization**: Compress uploaded images
- **Database Cleanup**: Remove old or unused data
- **Cache Management**: Clear caches when needed
- **Storage Management**: Monitor media storage usage

### Getting Support

#### Contact Information
- **Technical Support**: [support@kyuzo.ie]
- **Emergency Contact**: [Phone number to be added]
- **Documentation**: Check this manual first

#### Before Contacting Support
1. Check this manual for solutions
2. Review system logs for errors
3. Test the issue in different browsers
4. Document the exact steps to reproduce
5. Gather relevant error messages

#### Support Hours
- **Monday-Friday**: 9:00 AM - 8:00 PM
- **Saturday**: 9:00 AM - 5:00 PM
- **Sunday**: Emergency support only

---

## Additional Resources

### Training Materials
- **Video Tutorials**: [Links to be added]
- **Best Practices Guide**: [Document to be added]
- **FAQ Section**: [Document to be added]

### Integration Guides
- **Stripe Setup**: [Guide to be added]
- **Email Configuration**: [Guide to be added]
- **Backup Procedures**: [Guide to be added]

### Emergency Procedures
- **System Outage**: Contact technical support immediately
- **Data Loss**: Restore from latest backup
- **Security Breach**: Change passwords and review access logs

---

*This admin manual is regularly updated. For the most current information, please check the system documentation or contact technical support.*

*Last Updated: [Date to be added]*
*Version: 1.0* 