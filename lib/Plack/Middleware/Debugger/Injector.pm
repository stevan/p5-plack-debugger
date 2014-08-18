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

# ...

sub call {
    my ($self, $env) = @_;

    $self->response_cb(
        $self->app->( $env ), 
        sub { 
            my $resp = shift;

            # if no body, there is nothing to inject ...
            return if Plack::Util::status_with_no_entity_body( $resp->[0] );

            # check headers ...
            my $content_type = Plack::Util::header_get( $resp->[1], 'Content-Type' );

            if ( !$content_type ) {
                # ...???
                die "No content type specified in the request, I cannot tell what to do!";
            }
            elsif ( $content_type =~ m!^(?:text/html|application/xhtml\+xml)! ) {

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

                    return $resp ;
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
            else {
                die "I have no idea what to do with this body type";
            }

        }
    );
}


1;

__END__