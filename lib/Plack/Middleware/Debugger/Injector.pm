package Plack::Middleware::Debugger::Injector;

# ABSTRACT: Middleware for injecting content into a web request

use strict;
use warnings;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Middleware';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    die "You must pass the content to be injected"
        unless $args{'content'};

    die "The content to be injected must be either a string or a CODE reference"
        if !$args{'content'}
        || ref $args{'content'} && ref $args{'content'} ne 'CODE';

    $class->SUPER::new( %args );
}

# accessors ...

# the content to be injected, this is
# either a string or a CODE ref which
# takes the $env as an argument 
sub get_content_to_insert { 
    my ($self, $env) = @_;
    my $content = $self->{'content'};
    if ( ref $content && ref $content eq 'CODE' ) {
        $content = $content->( $env );
    }
    return $content;
} 

# predicates to check

sub should_ignore_status {
    my ($self, $env, $resp) = @_;
    # if it is in the 1xx - Informational range, we can ignore it 
    ($resp->[0] < 200)
        ||
    # within the 2xx - Success range we have the 204 No Content, which we should ignore 
    ($resp->[0] == 204)
        ||
    # within the 3xx - Redirection range we are unlikely to have a body, so we can ignore it
    ($resp->[0] < 400 && $resp->[0] >= 300)
        ||
    # pretty much ignore anything within the 4xx & 5xx Error ranges ...
    ($resp->[0] >= 400)
}

sub has_parent_request_uid {
    my ($self, $env, $resp) = @_;
    # NOTE:
    # if this is a request with a parent request id
    # then it is a sub-request and therefore not 
    # something we probably need to inject into,
    # however there could be cases where this is 
    # reasonable, so might make this optional later
    # if the need arises.
    # - SL
    exists $env->{'HTTP_X_PLACK_DEBUGGER_PARENT_REQUEST_UID'} 
        || 
    exists $env->{'plack.debugger.parent_request_uid'}    
}

# handlers to override

sub handle_no_content_type {
    my ($self, $env, $resp) = @_;
    # XXX - ... is this reasonable ???
    die "No content type specified in the request, I cannot tell what to do!";
}

sub pass_through_content_type {
    my ($self, $env, $resp) = @_;
    # many responses really can't 
    # get injected into so we 
    # just ignore and pass them 
    # through
    return $resp;
}

sub handle_json_content_type {
    my ($self, $env, $resp) = @_;
    # application/json responses really 
    # can't get injected into so we 
    # just ignore it for now, but we 
    # specifically handle this one
    # just in case ...
    return $resp;
}

sub handle_html_content_type {
    my ($self, $env, $resp) = @_;
    # content to be inserted ...
    my $content = $self->get_content_to_insert( $env );
    
    # if the response is not a streaming one ...
    if ( (scalar @$resp) == 3 && ref $resp->[2] eq 'ARRAY' ) {

        # adjust Content-Length if we have it ...
        if ( my $content_length = Plack::Util::header_get( $resp->[1], 'Content-Length' ) ) {
            Plack::Util::header_set( $resp->[1], 'Content-Length', $content_length + length($content) );
        }

        # now inject our content before the closing
        # body tag, makes the most sense to process
        # the body in reverse since it will most 
        # likely be at the end ...
        foreach my $chunk ( reverse @{ $resp->[2] } ) {
            # skip if we don't have it
            next unless $chunk =~ m!(?=</body>)!i; 
            # if we do have it, substitute and ...
            $chunk =~ s!(?=</body>)!$content!i;
            # break out of the loop, we are done 
            last;
        }

        return $resp;
    }
    # if we have streaming response, just do what is sensible
    else {
        # NOTE:
        # Plack will remove the Content-Length header
        # if it has a streaming response, so there is
        # no need to worry about that at all.
        # - SL
        return sub {
            my $chunk = shift;
            return unless defined $chunk;
            $chunk =~ s!(?=</body>)!$content!i;
            return $chunk;
        };
    }
}

sub handle_unknown_content_type {
    my ($self, $env, $resp) = @_;
    die "I have no idea what to do with this body type: " . Plack::Util::header_get( $resp->[1], 'Content-Type' );
}

# ...

sub call {
    my ($self, $env) = @_;

    $self->response_cb(
        $self->app->( $env ), 
        sub { 
            my $resp = shift;

            # check some basic predicates 
            return $resp if $self->should_ignore_status( $env, $resp );
            return $resp if $self->has_parent_request_uid( $env, $resp );

            # now check the content-type headers ...
            my $content_type = Plack::Util::header_get( $resp->[1], 'Content-Type' );

            if ( !$content_type ) {
                return $self->handle_no_content_type( $env, $resp );
            }
            # be more specific 
            elsif ( $content_type =~ m!^(?:text/html|application/xhtml\+xml)! ) {
                return $self->handle_html_content_type( $env, $resp );
            } 
            elsif ( $content_type =~ m!^(?:application/json)! ) {
                return $self->handle_json_content_type( $env, $resp );
            }
            # now be less specific
            elsif ( $content_type =~ m!^(?:application/)! ) {
                return $self->pass_through_content_type( $env, $resp );
            }
            elsif ( $content_type =~ m!^(?:text/)! ) {
                return $self->pass_through_content_type( $env, $resp );
            }
            elsif ( $content_type =~ m!^(?:image/)! ) {
                return $self->pass_through_content_type( $env, $resp );
            } 
            # ... final wrapup   
            else {
                return $self->handle_unknown_content_type( $env, $resp );
            }

        }
    );
}


1;

__END__

=pod

=head1 DESCRIPTION

This middleware is used to inject some content into the body of a 
given web request right before the closing C<<body>> tag. Its 
primary use-case is to inject a C<<script>> tag which will then 
create the L<Plack::Debugger> debugging UI. 

Since this middleware will run on every request it has to decide
if injection is sensible or not. It does this by checking the
HTTP status code, some HTTP headers and finally the content-type
of the response. 

=head2 Status codes

Most status codes not in the C<2xx> range are ignored since they
rarely contain a body that is of consequence to this module. The 
only exception being C<204 - No Content>, which will not have a 
body and so is ignored. 

=head2 Headers

Currently we only handle one header, C<X-Plack-Debugger-Parent-Request-UID>, 
which is a custom header that we add into AJAX requests that are 
associated with a given request. If we see this header, we will 
not bother injecting content since we can assume that it is meant
to be debugged via the parent page.

=head2 Content-Types

The following content-types are handled in the following order:

=over 4

=item No content-type specified

This currently throws an exception, perhaps this is not sensible, but
then again not specifying your content-type is not very sensible either.

=item C<text/html>, C<application/xhtml>, etc.

Given a content-type that looks like HTML, this will PSGI responses in 
the most sensible way possible.

If we detect a PSGI response which is an array of strings, we will process 
it (in reverse) looking for the closing C<<body>> tag and inject the 
content accordingly. 

All other PSGI responses will be handled as if they are streaming 
responses, in which case we simple return a C<CODE> reference that will
process the stream and if a closing C<<body>> tag is found, inject 
accordingly.

=item C<application/json>

While we have a specific handler for this content-type, we do not do 
anything but just let it pass through. This is handled in this way 
specifically in case someone decides it is sensible to inject some 
kind of data into a JSON response. 

It is left as an exercise to the reader to decide if this is sensible 
or not.

=item C<application/*>, C<text/*>, C<image/*>

These three content types are fairly common, but there is no obvious way
to inject content into them. So instead of guessing, we just let them pass 
through without modification. If there is any need to inject data into 
these response types it is simply a matter of overriding the 
C<pass_through_content_type> method in a subclass and then doing your own 
content-type dispatching.

=item Unknown content-type

If none of these content-types match then we throw an exception and complain
that we are not use what to actually do. Again, as with the lack of a 
content-type, this may not be sensible, if you disagree please give me a 
use case.

=back

=head1 METHODS

=over 4

=item C<new (%args)>

This expects a C<content> key in C<%args> which is either a string or 
a CODE reference that will accept a PSGI C<$env> as its only argument.

=item C<call ($env)>

This is just overriding the L<Plack::Middleware> C<call> method.

=item C<get_content_to_insert ($env)>

This will return the C<content> specified in C<new> and will just do 
the appropriate thing depending on if the C<content> was a string or 
a CODE reference.

=item HTTP Request predicates

The remaining methods deal with processing the HTTP request to 
determine if we should inject the C<content> or not.

=over 4

=item C<should_ignore_status ($env, $resp)>

This filters based on the HTTP status code, see the L<Status Codes>
section above for more details.

=item C<has_parent_request_uid ($env, $resp)>

If the request has the HTTP header that indicates it is a sub-request
(typically an AJAX call from the browser) then it should be injected
into, this method determines this. See the L<Headers> section above 
for more details.

=back

=item Content-Type handlers

It only makes sense to inject the debugger C<content> into certain
types of responses, these methods determine how and when to do this.
See the L<Content-Types> section above for more details.

=over 4

=item C<handle_no_content_type ($env, $resp)>

=item C<pass_through_content_type ($env, $resp)>

=item C<handle_json_content_type ($env, $resp)>

=item C<handle_html_content_type ($env, $resp)>

=item C<handle_unknown_content_type ($env, $resp)>

=back

=back

=head1 TODO

The following is a list of things this module might want to try and 
do, but which currently are not important to me. If one or more of these
features would be useful to you, please feel free to send patches.

=over 4

=item Detect User-Agents where injection is not sensible.

Injecting Javascript code into pages being viewed by browsers like Lynx 
or tools like c<cURL> or C<wget> would not make any sense.

=back

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.

=cut

