package Plack::Middleware::Debugger::Injector;

use strict;
use warnings;

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

sub has_no_body {
    my ($self, $env, $resp) = @_;
    # if no body, there is nothing to inject ...
    Plack::Util::status_with_no_entity_body( $resp->[0] )
        ||
    # if we have a redirect, then there is nothing to inject ...
    ($resp->[0] < 400 && $resp->[0] >= 300 && Plack::Util::header_exists( $resp->[1], 'Location' ))
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
            return $resp if $self->has_no_body( $env, $resp );
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

=head1 NAME

Plack::Middleware::Debugger::Injector - Middleware for injecting the debugger into a web request

=head1 DESCRIPTION

=head1 ACKNOWLEDGEMENTS

Thanks to Booking.com for sponsoring the writing of this module.

=cut




