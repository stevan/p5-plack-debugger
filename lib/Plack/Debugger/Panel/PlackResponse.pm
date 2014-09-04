package Plack::Debugger::Panel::PlackResponse;

use strict;
use warnings;

use Scalar::Util qw[ blessed ];

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Plack Response';
    $args{'formatter'} ||= 'ordered_key_value_pairs';

    $args{'after'} = sub {
        my ($self, $env, $resp) = @_;

        $self->notify( $resp->[0] >= 400 ? 'error' : 'success' );

        my @headers;
        Plack::Util::header_iter( $resp->[1], sub { push @headers, @_ } );

        $self->set_result([ 'Status' => $resp->[0], @headers, 'Body' => $self->format_body( $resp->[2] ) ]);
    };

    $class->SUPER::new( \%args );
}

sub format_body {
    my ($self, $body) = @_;
    return 'No Body'                    if !$body;
    return 'Streaming response($body)'  if ref $body eq 'CODE';

    my $length = Plack::Util::content_length( $body );
    return "IO::Object [ $body ] with length [ $length ]" if blessed $body;
    return "Filehandle [ $body ] with length [ $length ]" if Plack::Util::is_real_fh( $body );
    return "String [ $body ] with length [ $length ]"     if ref $body eq 'ARRAY';
    return "Unknown [ $body ]";
}

1;

__END__